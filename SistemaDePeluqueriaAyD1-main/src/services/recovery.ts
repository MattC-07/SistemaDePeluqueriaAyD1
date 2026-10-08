const MOCK_RECOVERY_CODE = '123456';
const MOCK_REQUEST_DELAY_MS = 700;
const MOCK_VERIFY_DELAY_MS = 500;
const MOCK_RESET_DELAY_MS = 700;

function delay(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(resolve, milliseconds));
}

export async function requestRecoveryCode(_email: string): Promise<void> {
  await delay(MOCK_REQUEST_DELAY_MS);
}

export async function verifyRecoveryCode(_email: string, code: string): Promise<boolean> {
  await delay(MOCK_VERIFY_DELAY_MS);
  return code === MOCK_RECOVERY_CODE;
}

export async function resetPassword(
  _email: string,
  _code: string,
  _newPassword: string
): Promise<void> {
  await delay(MOCK_RESET_DELAY_MS);
}
