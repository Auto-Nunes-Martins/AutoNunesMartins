import http from 'node:http';
const host = new URL(process.env.WEBSITE_ORIGIN).host;
const request = http.get(
  {
    hostname: '127.0.0.1',
    port: Number(process.env.PORT || 10000),
    path: '/healthz',
    headers: { host },
  },
  (response) => {
    response.resume();
    if (response.statusCode !== 200) process.exitCode = 1;
  },
);
request.on('error', () => {
  process.exitCode = 1;
});
request.setTimeout(2000, () => request.destroy());
