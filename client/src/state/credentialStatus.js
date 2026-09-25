// @ts-check

/**
 * @typedef {{status: 'success'|'error', clearInput: boolean}} CredentialSaveStatus
 */

/**
 * Project a credential-save acknowledgement into the small status algebra
 * consumed by the remote view. Transport-specific event names and input
 * clearing stay in the Socket.IO shell.
 *
 * @param {unknown} response
 * @returns {CredentialSaveStatus|null}
 */
export const projectCredentialSaveStatus = (response) => {
  const responseRecord = response == null
    ? null
    : /** @type {{success?: unknown}} */ (Object(response));
  const { success } = responseRecord || {};

  if (typeof success !== 'boolean') {
    return null;
  }

  return {
    status: success ? 'success' : 'error',
    clearInput: success
  };
};
