import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { getAuthToken } from "@/lib/api";

interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: getAuthToken(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
  },
});

export const { setToken } = authSlice.actions;
export default authSlice.reducer;
