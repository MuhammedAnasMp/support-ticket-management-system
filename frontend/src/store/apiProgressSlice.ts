import { createSlice } from '@reduxjs/toolkit';

export interface ApiProgressState {
  activeRequests: number;
  isLoading: boolean;
}

const initialState: ApiProgressState = {
  activeRequests: 0,
  isLoading: false,
};

export const apiProgressSlice = createSlice({
  name: 'apiProgress',
  initialState,
  reducers: {
    startApiCall: (state) => {
      state.activeRequests += 1;
      state.isLoading = true;
    },
    finishApiCall: (state) => {
      state.activeRequests = Math.max(0, state.activeRequests - 1);
      state.isLoading = state.activeRequests > 0;
    },
    resetApiProgress: (state) => {
      state.activeRequests = 0;
      state.isLoading = false;
    },
  },
});

export const { startApiCall, finishApiCall, resetApiProgress } = apiProgressSlice.actions;
export default apiProgressSlice.reducer;
