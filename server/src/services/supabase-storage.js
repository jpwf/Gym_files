const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const CARDIO_BUCKET = 'comprovantes-cardio';
const SIGNED_URL_SECONDS = 5 * 60;
const IMAGE_FORMATS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

let supabaseAdmin;

function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada.');
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }

  return supabaseAdmin;
}

function extractCardioProofPath(storedValue) {
  if (typeof storedValue !== 'string' || !storedValue) return null;

  let objectPath = storedValue;
  if (/^https?:\/\//i.test(storedValue)) {
    try {
      const url = new URL(storedValue);
      const markers = [
        `/storage/v1/object/public/${CARDIO_BUCKET}/`,
        `/storage/v1/object/sign/${CARDIO_BUCKET}/`,
      ];
      const marker = markers.find((candidate) => url.pathname.includes(candidate));
      if (!marker) return null;
      objectPath = decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
    } catch {
      return null;
    }
  }

  const segments = objectPath.split('/');
  if (!objectPath || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return objectPath;
}

async function uploadCardioProof(userId, buffer) {
  const { fileTypeFromBuffer } = await import('file-type');
  const detectedType = await fileTypeFromBuffer(buffer);
  const extension = detectedType && IMAGE_FORMATS.get(detectedType.mime);

  if (!extension) {
    const error = new Error('O comprovante deve ser uma imagem JPEG, PNG ou WebP válida.');
    error.statusCode = 415;
    throw error;
  }

  const objectPath = `cardios/${String(userId)}/${randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdmin().storage
    .from(CARDIO_BUCKET)
    .upload(objectPath, buffer, {
      contentType: detectedType.mime,
      upsert: false,
    });

  if (error) {
    throw new Error(`Falha ao armazenar comprovante: ${error.message}`);
  }

  return objectPath;
}

async function createCardioProofSignedUrl(storedValue) {
  const objectPath = extractCardioProofPath(storedValue);
  if (!objectPath) return null;

  const { data, error } = await getSupabaseAdmin().storage
    .from(CARDIO_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_SECONDS);

  if (error) {
    throw new Error(`Falha ao gerar URL temporária do comprovante: ${error.message}`);
  }

  return data.signedUrl;
}

async function listObjectPaths(prefix, search, namePrefix) {
  const bucket = getSupabaseAdmin().storage.from(CARDIO_BUCKET);
  const objectPaths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const options = { limit, offset };
    if (search) options.search = search;
    const { data, error } = await bucket.list(prefix, options);
    if (error) throw new Error(`Falha ao listar comprovantes: ${error.message}`);

    const files = (data || [])
      .filter((entry) => entry.id && entry.name.startsWith(namePrefix))
      .map((entry) => prefix ? `${prefix}/${entry.name}` : entry.name);
    objectPaths.push(...files);

    if (!data || data.length < limit) break;
    offset += limit;
  }

  return objectPaths;
}

async function removeCardioProofFiles(userId) {
  const id = String(userId);
  const paths = [
    ...(await listObjectPaths(`cardios/${id}`, '', '')),
    ...(await listObjectPaths('', `cardio-${id}-`, `cardio-${id}-`)),
  ];

  if (paths.length === 0) return;

  const { error } = await getSupabaseAdmin().storage.from(CARDIO_BUCKET).remove(paths);
  if (error) {
    throw new Error(`Falha ao remover comprovantes do usuário: ${error.message}`);
  }
}

module.exports = {
  createCardioProofSignedUrl,
  removeCardioProofFiles,
  uploadCardioProof,
};
