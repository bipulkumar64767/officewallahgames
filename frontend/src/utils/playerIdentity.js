/**
 * Helper to ensure each browser tab/guest window has a distinct, stable player ID.
 * Even if 2 tabs are opened in the same browser session or incognito, they won't conflict.
 */
export const getPlayerIdentity = (user) => {
  let tabId = sessionStorage.getItem('owg_tab_player_id');
  if (!tabId) {
    tabId = 'P_' + Math.random().toString(36).substring(2, 8) + '_' + Date.now().toString(36);
    sessionStorage.setItem('owg_tab_player_id', tabId);
  }

  if (user && user.userId) {
    return {
      playerId: `${user.userId}_${tabId}`,
      playerName: user.displayName || 'Player',
      isGuest: Boolean(user.isGuest),
    };
  }

  return {
    playerId: `GUEST_${tabId}`,
    playerName: 'Guest Player',
    isGuest: true,
  };
};
