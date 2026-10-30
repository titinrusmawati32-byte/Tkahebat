/**
 * Vercel Serverless Function Proxy (/api/gas)
 * Menghubungkan Frontend ke Google Apps Script di level cloud (di luar aplikasi)
 * Menggunakan Environment Variable: GAS_URL
 */

export default async function handler(req, res) {
  // Ambil URL Google Apps Script dari Environment Variables Vercel
  const gasUrl = process.env.GAS_URL;

  if (!gasUrl) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Variabel lingkungan GAS_URL belum dikonfigurasi di Vercel Environment Variables.'
      }
    });
  }

  // Handle preflight OPTIONS jika diperlukan
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  try {
    const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

    // Forward request ke Google Apps Script Web App
    const gasResponse = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: payload
    });

    const data = await gasResponse.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to GAS:', error);
    return res.status(502).json({
      success: false,
      error: {
        message: 'Gagal terhubung ke Google Apps Script: ' + error.message
      }
    });
  }
}
