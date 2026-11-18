/* OpenGate Data — form endpoints.
   Leave an endpoint empty while the secure intake service is not connected:
   the form validates, then shows a beta notice and sends nothing.

   When the intake service is live, set each endpoint to its URL. The service is expected to:
   1. receive the form as multipart/form-data,
   2. store bank statements in private, encrypted storage,
   3. create the Monday item (Broker Form board or Gateway Form board) with the
      submission details and a secure, access-controlled link to the files,
      never the statements as attachments,
   4. return JSON { "ok": true }. */
window.OGD_CONFIG = {
  brokerEndpoint: "",
  gatewayEndpoint: "",
  bookingUrl: "https://calendar.app.google/JTbyWT2rURonvT2TA"
};
