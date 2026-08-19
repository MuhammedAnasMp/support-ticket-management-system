import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

export interface StoreDetails {
  store_id: number;
  store_name: string;
}

export interface UserDetails {
  user_id: number;
  username: string;
  email: string;
  employee_no: string;
  full_name: string;
  phone: string;
  whatsapp_number: string;
  role: string | null;
  active: boolean;
  profile_image: string | null;
  sub_departments: string[];
  natures?: string[];
  tickets_created_count?: number;
  tickets_assigned_count?: number;
}

export interface AuthState {
  token: string | null;
  user: UserDetails | null;
  permissions: string[];
  accessibleStores: StoreDetails[];
}

const storedToken = localStorage.getItem('token');
const storedUser = localStorage.getItem('user');

let initialUser: UserDetails | null = null;
let initialPermissions: string[] = [];
let initialAccessibleStores: StoreDetails[] = [];

if (storedUser) {
  try {
    const parsed = JSON.parse(storedUser);
    // Support parsing from flat structure or nested structure
    initialUser = parsed.user || parsed;
    initialPermissions = parsed.permissions || [];
    initialAccessibleStores = parsed.accessible_stores || [];
  } catch (e) {
    // Ignore invalid storage
  }
}

const initialState: AuthState = {
  token: storedToken,
  user: initialUser,
  permissions: initialPermissions,
  accessibleStores: initialAccessibleStores,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(
      state,
      action: PayloadAction<{
        token: string;
        user: UserDetails;
        permissions: string[];
        accessibleStores: StoreDetails[];
      }>
    ) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.permissions = action.payload.permissions;
      state.accessibleStores = action.payload.accessibleStores;

      localStorage.setItem('token', action.payload.token);
      localStorage.setItem(
        'user',
        JSON.stringify({
          user: action.payload.user,
          permissions: action.payload.permissions,
          accessible_stores: action.payload.accessibleStores,
        })
      );
    },
    clearCredentials(state) {
      state.token = null;
      state.user = null;
      state.permissions = [];
      state.accessibleStores = [];

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('ticket-filter-from-date');
      localStorage.removeItem('ticket-filter-to-date');
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
