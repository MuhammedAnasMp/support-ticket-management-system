import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import apiProgressReducer from './apiProgressSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    apiProgress: apiProgressReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
