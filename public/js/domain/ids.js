// Unique id generator: a session counter plus a base-36 time suffix.
let uid = 1;
export const nid = () => "i" + (uid++) + Date.now().toString(36);
