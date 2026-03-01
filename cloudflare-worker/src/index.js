// Cloudflare Worker for RSS CORS Proxy
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // CORS configuration
  const allowedOrigins = [
    'https://podcast.kaizenmadeeasy.com',
    'https://kaizenmadeeasy.com',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ]

  const origin = request.headers.get('Origin')
  const isAllowedOrigin = allowedOrigins.includes(origin)

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const headers = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-requested-with, X-Requested-With',
      'Access-Control-Max-Age': '86400'
    }
    
    if (isAllowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin
    }
    
    return new Response(null, { headers })
  }

  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('url')

    if (!targetUrl) {
      return new Response('Missing url parameter', { 
        status: 400,
        headers: getCorsHeaders(isAllowedOrigin, origin)
      })
    }

    // Validate URL
    try {
      new URL(targetUrl)
    } catch {
      return new Response('Invalid URL', { 
        status: 400,
        headers: getCorsHeaders(isAllowedOrigin, origin)
      })
    }

    console.log(`Fetching RSS: ${targetUrl}`)

    // Fetch the RSS feed
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'KaizenPodcastRSSProxy/1.0 (+https://podcast.kaizenmadeeasy.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'Accept-Encoding': 'gzip, deflate'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Get the content
    const contentType = response.headers.get('content-type') || ''
    const content = await response.text()

    // Validate that we got XML/RSS content
    if (!contentType.includes('xml') && !content.trim().startsWith('<?xml') && !content.trim().startsWith('<rss')) {
      console.log(`Unexpected content type: ${contentType}, content preview: ${content.substring(0, 200)}`)
    }

    // Return the RSS content with proper CORS headers
    return new Response(content, {
      status: 200,
      headers: {
        ...getCorsHeaders(isAllowedOrigin, origin),
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(`Proxy error: ${error.message}`, { 
      status: 500,
      headers: getCorsHeaders(isAllowedOrigin, origin)
    })
  }
}

function getCorsHeaders(isAllowedOrigin, origin) {
  const headers = {}
  
  if (isAllowedOrigin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  
  return headers
}
