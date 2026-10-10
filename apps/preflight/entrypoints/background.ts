export default defineBackground(() => {
  // Provider calls for Improve and session summaries will run here, so the
  // user's key is used from one place and never touches a page's scripts.
});
