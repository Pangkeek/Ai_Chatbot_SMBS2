// Windows has no POSIX signal delivery; exercise the same registered Node handler.
process.on('message', message => {
  if (process.platform === 'win32' && ['SIGINT', 'SIGTERM'].includes(message.signal)) process.emit(message.signal);
});
await import('../../scripts/start.js');
