export async function readDocument(file) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a document smaller than 5 MB.");
  let text;
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > 20)
        throw new Error("Choose a document with 20 pages or fewer.");
      const pages = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        const body = content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join("");
        pages.push(`[Page ${n}]\n${body}`);
      }
      text = pages.join("\n\n");
    } finally {
      await pdf.destroy();
    }
    if (text.replace(/\[Page \d+\]/g, "").trim().length < 10)
      throw new Error(
        "This PDF appears to be scanned or has no readable text. Paste its relevant text; image OCR is not connected yet.",
      );
  } else if (/\.(txt|md)$/i.test(file.name)) {
    text = await file.text();
  } else throw new Error("Choose a PDF, TXT or Markdown document.");
  if (!text.trim() || text.length > 60000)
    throw new Error(
      "Choose a shorter source with 1–60,000 readable characters.",
    );
  return {
    text,
    type: /\.pdf$/i.test(file.name)
      ? "application/pdf"
      : /\.md$/i.test(file.name)
        ? "text/markdown"
        : "text/plain",
  };
}
