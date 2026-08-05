const createFormattedLine = (line, documentRef) => {
  const block = documentRef.createElement("div");
  block.style.whiteSpace = "pre-wrap";
  block.style.margin = "0";
  block.style.padding = "0";
  block.textContent = line;
  return block;
};

export const replaceContenteditableDom = (input, value, documentRef = document) => {
  if (!input || typeof input.replaceChildren !== "function") return false;

  const text = String(value ?? "");
  if (typeof documentRef?.createElement !== "function") {
    input.replaceChildren(documentRef.createTextNode(text));
    return input.textContent === text;
  }

  const lines = text.split(/\r?\n/);
  const nodes = lines.length > 1
    ? lines.map((line) => createFormattedLine(line, documentRef))
    : [createFormattedLine(lines[0] ?? "", documentRef)];

  input.replaceChildren(...nodes);
  const readback = typeof input.innerText === "string" ? input.innerText : input.textContent;
  return readback === text;
};
