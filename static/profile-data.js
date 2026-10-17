// Shared public résumé facts for the portfolio and its AI avatar.
const response = await fetch(new URL('./profile.json', import.meta.url));
if (!response.ok) throw new Error('Portfolio content could not be loaded.');
export const { chapters, projects, profile } = await response.json();
