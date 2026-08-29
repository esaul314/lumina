/**
 * Project a credential-save acknowledgement into the small status algebra
 * consumed by the remote view. Transport-specific event names and input
 * clearing stay in the Socket.IO shell.
 *
 * @param {unknown} response
 * @returns {{status: 'success'|'error', clearInput: boolean}|null}
 */
export const projectCredentialSaveStatus = (response) => {
  if (typeof response?.success !== 'boolean') {
    return null;
  }

  return {
    status: response.success ? 'success' : 'error',
    clearInput: response.success
  };
};
