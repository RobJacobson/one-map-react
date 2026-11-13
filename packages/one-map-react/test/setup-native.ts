import { beforeEach, jest } from "@jest/globals";
import { AppState } from "react-native";

// The RN preset supplies a function as currentState and no subscription receipt.
beforeEach(() => {
  AppState.currentState = "active";
  jest.mocked(AppState.addEventListener).mockReturnValue({ remove: jest.fn() });
});
