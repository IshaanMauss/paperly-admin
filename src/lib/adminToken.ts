let adminAccessToken = "";

export function setAdminAccessToken(token: string) {
  adminAccessToken = token;
}

export function getAdminAccessToken() {
  return adminAccessToken;
}

export function clearAdminAccessToken() {
  adminAccessToken = "";
}
