export const replaceContenteditableDom = (input, value, documentRef = document) => {
  if (!input || typeof input.replaceChildren !== "function") return false;
  input.replaceChildren(documentRef.createTextNode(value));
  return input.textContent === value;
};
