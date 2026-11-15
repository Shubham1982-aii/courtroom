// Audio & Video permission matrix for Courtroom Mesh
export const microphoneRoles = ['petitioner', 'judge', 'defendant'];

export const canSpeak = role => microphoneRoles.includes(role);

export const canListen = role => canSpeak(role) || ['jury', 'audience'].includes(role);

export const canConnectAudio = (from, to) =>
  canListen(from) && canListen(to) && (canSpeak(from) || canSpeak(to));
