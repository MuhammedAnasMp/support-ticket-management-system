import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Loader2, AlertCircle, MapPin, X, CheckCircle2 } from 'lucide-react';
import type { RootState } from '../store';
import { setCredentials } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const StoreCompletionModal: React.FC = () => {
  const dispatch = useDispatch();
  const { token, user, permissions, accessibleStores } = useSelector((state: RootState) => state.auth);

  const [isOpen, setIsOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const managedStore = user?.managed_store;
  const isStoreIncomplete = !!managedStore && (
    !managedStore.phone ||
    !managedStore.whatsapp_number ||
    !managedStore.address ||
    !managedStore.longitude ||
    !managedStore.latitude
  );

  const hasCheckedAutoOpen = useRef(false);

  useEffect(() => {
    if (!token) {
      hasCheckedAutoOpen.current = false;
      setIsOpen(false);
    }
  }, [token]);
  console.log("dsf")
  // Auto-open logic on load
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      return;
    }

    if (!token || !user || !isStoreIncomplete || hasCheckedAutoOpen.current) {
      return;
    }

    hasCheckedAutoOpen.current = true;

    // Set initial values from store profile (filling what exists)
    setPhone(managedStore?.phone || '');
    setWhatsappNumber(managedStore?.whatsapp_number || '');
    setAddress(managedStore?.address || '');
    setLatitude(managedStore?.latitude || '');
    setLongitude(managedStore?.longitude || '');

    const today = new Date().toISOString().split('T')[0];
    const storageKey = `store_popup_shows_${user.user_id}`;
    const dataStr = localStorage.getItem(storageKey);
    let count = 0;

    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.date === today) {
          count = data.count;
        }
      } catch (e) { }
    }

    if (count < 3) {
      setIsOpen(true);
      // Increment show count
      localStorage.setItem(storageKey, JSON.stringify({ date: today, count: count + 1 }));
    }
  }, [token, user, isStoreIncomplete, managedStore]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setErrorMsg(null);

    // Helper to perform Nominatim reverse geocoding
    const fetchAddressFromCoords = async (lat: number, lon: number) => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MaintenanceTrackerApp/1.0'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.display_name) {
            setAddress(data.display_name);
          }
        }
      } catch (err) {
        console.warn('Reverse geocoding failed:', err);
      }
    };

    // Helper to fall back to IP location trying multiple APIs in sequence
    const fallbackToIpLocation = async (originalErrorMsg: string) => {
      const apis = [
        {
          url: 'https://freeipapi.com/api/json',
          parse: (data: any) => ({
            lat: Number(data.latitude),
            lon: Number(data.longitude),
            address: [data.cityName, data.regionName, data.countryName].filter(Boolean).join(', ')
          })
        },
        {
          url: 'https://ipwho.is/',
          parse: (data: any) => ({
            lat: Number(data.latitude),
            lon: Number(data.longitude),
            address: [data.city, data.region, data.country].filter(Boolean).join(', ')
          })
        },
        {
          url: 'https://ipapi.co/json/',
          parse: (data: any) => ({
            lat: Number(data.latitude),
            lon: Number(data.longitude),
            address: [data.city, data.region, data.country_name].filter(Boolean).join(', ')
          })
        }
      ];

      for (const api of apis) {
        try {
          const res = await fetch(api.url);
          if (res.ok) {
            const data = await res.json();
            const parsed = api.parse(data);
            if (parsed.lat && parsed.lon) {
              setLatitude(parsed.lat.toFixed(6));
              setLongitude(parsed.lon.toFixed(6));
              setAddress(parsed.address || 'IP-based location');
              await fetchAddressFromCoords(parsed.lat, parsed.lon);
              return;
            }
          }
        } catch (e) {
          console.warn(`IP Geolocation from ${api.url} failed, trying next fallback...`, e);
        }
      }

      // If all fallbacks fail, show original error
      setErrorMsg(originalErrorMsg);
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        setLatitude(lat.toFixed(6));
        setLongitude(lon.toFixed(6));

        await fetchAddressFromCoords(lat, lon);
        setLocating(false);
      },
      async (error) => {
        console.warn('Geolocation failed, trying IP fallback:', error.message);
        await fallbackToIpLocation(`Failed to retrieve location: ${error.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 5000 } // Short timeout to fail fast and trigger IP fallback
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !managedStore) return;

    // Validation
    const phoneRegex = /^\d{8}$/;
    const whatsappRegex = /^\d{8}$|^\d{10}$/;

    if (!phoneRegex.test(phone)) {
      setErrorMsg('Location Contact Number must be exactly 8 digits.');
      return;
    }

    if (!whatsappRegex.test(whatsappNumber)) {
      setErrorMsg('WhatsApp Number must be either 8 or 10 digits.');
      return;
    }

    if (!address.trim()) {
      setErrorMsg('Street Address is required.');
      return;
    }

    if (!latitude || !longitude) {
      setErrorMsg('Coordinates (Latitude & Longitude) are required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_URL}/stores/store/${managedStore.store_id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone,
          whatsapp_number: whatsappNumber,
          address,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        })
      });

      if (response.ok) {
        const updatedStore = await response.json();

        // Update user state in Redux
        const updatedUser = {
          ...user,
          managed_store: {
            ...user?.managed_store,
            phone: updatedStore.phone,
            whatsapp_number: updatedStore.whatsapp_number,
            address: updatedStore.address,
            longitude: String(updatedStore.longitude),
            latitude: String(updatedStore.latitude),
          }
        };

        dispatch(setCredentials({
          token,
          user: updatedUser as any,
          permissions,
          accessibleStores
        }));

        setSuccess(true);
        setTimeout(() => {
          setIsOpen(false);
          setSuccess(false);
        }, 1500);
      } else {
        const errData = await response.json();
        setErrorMsg(errData.detail || errData.phone || errData.whatsapp_number || 'Failed to update store details.');
      }
    } catch (err) {
      setErrorMsg('Network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !managedStore) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 .bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-surface dark:bg-dark-surface border border-outline-variant dark:border-dark-outline-variant rounded shadow-xl overflow-hidden z-10 transition-all p-6">

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant dark:border-dark-outline-variant mb-5">
          <div>
            <h3 className="text-base font-bold text-on-surface dark:text-dark-on-surface">
              Complete Location Details
            </h3>
            <p className="text-[10px] text-outline mt-0.5">
              Please complete store location contact numbers and coordinates
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-outline cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
            <h4 className="font-bold text-sm text-on-surface dark:text-dark-on-surface">Store Completed!</h4>
            <p className="text-xs text-outline">Location details have been successfully saved.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Store Information Summary (Read Only) */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant rounded text-xs text-on-surface-variant dark:text-dark-on-surface-variant">
              <div>
                <span className="block text-[10px] text-outline">Location Code</span>
                <span className="font-semibold">{managedStore.store_id}</span>
              </div>
              <div>
                <span className="block text-[10px] text-outline">Location Name</span>
                <span className="font-semibold">{managedStore.store_name}</span>
              </div>
              <div>
                <span className="block text-[10px] text-outline">Location Type</span>
                <span className="font-semibold">{managedStore.type || 'Fresh'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-outline">Area Location</span>
                <span className="font-semibold">{managedStore.area_name || 'New Area'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5">Location Contact No *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="8 digits"
                  className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                />
              </div>

              {/* Whatsapp */}
              <div>
                <label className="block text-xs font-semibold text-outline mb-1.5">Location WhatsApp No *</label>
                <input
                  type="text"
                  required
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value)}
                  placeholder="8 or 10 digits"
                  className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                />
              </div>
            </div>

            {/* Locate Me Section */}
            {(!latitude || !longitude) && (
              <div className="flex items-center justify-between gap-2 p-2 border border-dashed border-primary/40 rounded bg-primary/5">
                <span className="text-[11px] text-primary font-medium pl-1">Autofill coords & address</span>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary text-[10px] font-bold px-3 py-1.5 rounded transition-colors cursor-pointer disabled:opacity-70"
                >
                  {locating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5" />
                  )}
                  Use Location
                </button>
              </div>
            )}

            {/* Coordinates & Address */}
            {latitude && longitude && (
              <>
                {/* Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Latitude *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      disabled
                      value={latitude}
                      onChange={e => setLatitude(e.target.value)}
                      placeholder="e.g. 29.3759"
                      className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-outline mb-1.5">Longitude *</label>
                    <input
                      type="number"
                      step="any"
                      disabled
                      required
                      value={longitude}
                      onChange={e => setLongitude(e.target.value)}
                      placeholder="e.g. 47.9784"
                      className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface"
                    />
                  </div>
                </div>

                {/* Street Address */}
                <div>
                  <label className="block text-xs font-semibold text-outline mb-1.5">Street Address *</label>
                  <textarea
                    required
                    rows={2}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Enter location address details"
                    className="w-full text-xs bg-surface-container-low dark:bg-dark-surface-container-low border border-outline-variant dark:border-dark-outline-variant p-2.5 rounded outline-none focus:border-primary text-on-surface dark:text-dark-on-surface resize-none"
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-outline-variant dark:border-dark-outline-variant">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-outline hover:text-on-surface rounded-lg cursor-pointer bg-transparent border-none"
              >
                Remind Me Later
              </button>
              <button
                type="submit"
                disabled={loading || locating || !latitude || !longitude}
                className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-75"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Details
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
