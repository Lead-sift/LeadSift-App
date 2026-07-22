import { supabase } from "./supabaseClient.js";

export interface ImagenExtraida {
  pagina: number | null;
  buffer: Buffer;
  extension: "png" | "jpeg";
}

export interface ResultadoExtraccion {
  texto: string;
  imagenes: ImagenExtraida[];
}

// PDF: pdf-parse v2 extrae tanto el texto como las imágenes incrustadas de
// verdad (foto por foto, no la página entera rasterizada), vía @napi-rs/canvas
// (binarios precompilados, sin necesitar poppler/imagemagick en el servidor).
// imageThreshold descarta iconos/decoraciones diminutas, quedándose con fotos
// de producto reales.
async function extraerDePdf(buffer: Buffer): Promise<ResultadoExtraccion> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });

  try {
    const textoResultado = await parser.getText();
    const imagenResultado = await parser.getImage({ imageBuffer: true, imageThreshold: 80 });

    const imagenes: ImagenExtraida[] = [];
    for (const pagina of imagenResultado.pages) {
      for (const img of pagina.images) {
        imagenes.push({ pagina: pagina.pageNumber, buffer: Buffer.from(img.data), extension: "png" });
      }
    }

    return { texto: textoResultado.text, imagenes };
  } finally {
    await parser.destroy();
  }
}

// Word (.docx): mammoth extrae cada imagen incrustada por separado — el
// propio .docx ya guarda las fotos como ficheros independientes dentro del archivo.
async function extraerDeWord(buffer: Buffer): Promise<ResultadoExtraccion> {
  const mammoth = await import("mammoth");
  const imagenes: ImagenExtraida[] = [];

  const opciones = {
    convertImage: mammoth.default.images.imgElement(async (imagen: any) => {
      const datosBase64 = await imagen.read("base64");
      const extension = imagen.contentType?.includes("png") ? "png" : "jpeg";
      imagenes.push({ pagina: null, buffer: Buffer.from(datosBase64, "base64"), extension });
      return { src: "" }; // no nos interesa el HTML resultante, solo el texto y las imágenes
    }),
  };

  const resultado = await mammoth.default.extractRawText({ buffer });
  await mammoth.default.convertToHtml({ buffer }, opciones); // dispara la extracción de imágenes

  return { texto: resultado.value, imagenes };
}

export async function extraerDocumento(
  buffer: Buffer,
  nombreArchivo: string
): Promise<ResultadoExtraccion> {
  const extension = nombreArchivo.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return extraerDePdf(buffer);
  if (extension === "docx") return extraerDeWord(buffer);

  throw new Error(`Formato no soportado: .${extension}. Solo se admiten .pdf y .docx.`);
}

export async function subirImagenesCatalogo(
  empresaId: string,
  nombreArchivo: string,
  imagenes: ImagenExtraida[]
) {
  const filas = [];
  for (let i = 0; i < imagenes.length; i++) {
    const img = imagenes[i];
    const ruta = `${empresaId}/${Date.now()}-${i}.${img.extension}`;

    const { error: errorSubida } = await supabase.storage
      .from("catalogo-imagenes")
      .upload(ruta, img.buffer, { contentType: `image/${img.extension}` });

    if (errorSubida) {
      throw new Error(`No se pudo subir la imagen ${i}: ${errorSubida.message}`);
    }

    const { data: urlPublica } = supabase.storage.from("catalogo-imagenes").getPublicUrl(ruta);

    filas.push({
      empresa_id: empresaId,
      documento_origen: nombreArchivo,
      pagina: img.pagina,
      ruta_storage: ruta,
      url_publica: urlPublica.publicUrl,
    });
  }

  if (filas.length === 0) return [];

  const { data, error } = await supabase.from("imagenes_catalogo").insert(filas).select();
  if (error) throw new Error(`No se pudieron registrar las imágenes: ${error.message}`);
  return data;
}
