const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { randomUUID } = require('node:crypto');

// Formatos permitidos (magic bytes validation)
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

// Diretório temporário para uploads
const UPLOAD_DIR = path.join(os.tmpdir(), 'gymfiles-uploads');

// Garante que diretório existe
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    // Validação rápida por MIME type (client-side)
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
    // Validação real por magic bytes será feita no middleware validateImageMagicBytes
    cb(null, true);
  },
});

// Cleanup periódico (roda a cada 10 min) - remove arquivos > 1 hora
setInterval(async () => {
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    const now = Date.now();
    for (const file of files) {
      const filepath = path.join(UPLOAD_DIR, file);
      const stat = await fs.stat(filepath);
      if (now - stat.mtimeMs > 60 * 60 * 1000) {
        await fs.unlink(filepath).catch(() => {});
      }
    }
  } catch (error) {
    // Ignora erros de limpeza
  }
}, 10 * 60 * 1000);

// Middleware adicional para validar magic bytes após upload
async function validateImageMagicBytes(req, res, next) {
  if (!req.file) {
    return next();
  }

  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const buffer = await fs.readFile(req.file.path);
    const type = await fileTypeFromBuffer(buffer);

    // Limpa o arquivo temporário após ler
    await fs.unlink(req.file.path).catch(() => {});

    if (!type || !ALLOWED_IMAGE_TYPES.has(type.mime)) {
      return res.status(415).json({
        error: 'Arquivo inválido. Apenas imagens JPEG, PNG ou WebP são permitidas.'
      });
    }

    // Opcional: sobrescreve mimetype com o detectado real
    req.file.mimetype = type.mime;
    // Armazena buffer validado para uso posterior
    req.file.buffer = buffer;
    next();
  } catch (error) {
    console.error('Erro ao validar magic bytes:', error);
    // Tenta limpar arquivo em caso de erro
    if (req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({ error: 'Erro ao validar arquivo.' });
  }
}

module.exports = { upload, validateImageMagicBytes };
