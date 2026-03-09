exports.handler = async function () {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ ok: true, service: 'brazuca-fc-v3', timestamp: new Date().toISOString() })
  };
};
