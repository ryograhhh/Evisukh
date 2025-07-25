const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuration constants
const API_HOST = 'https://kisskh.co';
const API_INFO = 'https://kisskh.co/api/DramaList/Drama/';
const API_EPISODE = 'https://kisskh.co/api/DramaList/Episode/';

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// Helper functions
const getMediaInfo = async (mediaID) => {
    const url = `${API_INFO}${mediaID}`;
    console.log('Fetching media info from:', url);
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://kisskh.co/',
                'Origin': 'https://kisskh.co',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            },
            timeout: 30000
        });
        return response.data;
    } catch (error) {
        console.error('Media info fetch error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
};

const getPngImage = async (imageUrl) => {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://kisskh.co/',
                'Origin': 'https://kisskh.co',
                'Accept': 'image/png,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000
        });
        const base64Image = Buffer.from(response.data).toString('base64');
        return base64Image;
    } catch (error) {
        console.error('PNG image fetch error:', error.message);
        throw new Error(`Failed to fetch episode data: ${error.message}`);
    }
};

const getSubtitles = async (subID) => {
    const url = `https://kisskh.co/api/Sub/${subID}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://kisskh.co/',
                'Origin': 'https://kisskh.co',
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 15000
        });
        return response.data;
    } catch (error) {
        console.log('Subtitles fetch error:', error.message);
        return { error: 'Subtitles not available', message: error.message };
    }
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api', (req, res) => {
    res.status(200).json({
        name: "Evisukh API",
        description: "Unofficial kisskh API wrapper for streaming content",
        endpoints: {
            media: "/api/:mediaID - Get media information",
            source: "/api/source/:episodeID - Get episode sources and subtitles"
        },
        usage: {
            media: "Extract ID from kisskh.co URL (e.g., id=9301) and use /api/9301",
            source: "Use episode ID from media response to get streaming links"
        },
        author: "Evisukh - Enhanced kisskh API"
    });
});

app.get('/api/:mediaID', async (req, res) => {
    const mediaID = req.params.mediaID;
    
    if (!mediaID || isNaN(mediaID)) {
        return res.status(400).json({ 
            error: 'Invalid media ID. Please provide a numeric ID from kisskh.co URL' 
        });
    }

    try {
        console.log(`Fetching media info for ID: ${mediaID}`);
        const mediaInfo = await getMediaInfo(mediaID);
        
        if (!mediaInfo) {
            return res.status(404).json({ 
                error: 'Media not found. Please check the ID and try again.',
                mediaID: mediaID
            });
        }

        res.status(200).json({
            success: true,
            mediaID: mediaID,
            data: mediaInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching media info:', error.message);
        
        let errorMessage = 'Failed to fetch media information';
        if (error.message.includes('timeout')) {
            errorMessage = 'Request timeout - kisskh.co may be slow or unavailable';
        } else if (error.message.includes('ENOTFOUND')) {
            errorMessage = 'Cannot connect to kisskh.co - check internet connection';
        } else if (error.response && error.response.status === 404) {
            errorMessage = 'Media not found - please check the media ID';
        } else if (error.response && error.response.status === 403) {
            errorMessage = 'Access denied - kisskh.co may be blocking requests';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message,
            mediaID: mediaID,
            timestamp: new Date().toISOString(),
            suggestion: 'Try using a different media ID from kisskh.co'
        });
    }
});

app.get('/api/source/:episodeID', async (req, res) => {
    const episodeID = req.params.episodeID;
    
    if (!episodeID || isNaN(episodeID)) {
        return res.status(400).json({ 
            error: 'Invalid episode ID. Please provide a numeric episode ID' 
        });
    }

    const imageUrl = `${API_EPISODE}${episodeID}.png?err=false&ts=&time=`;
    console.log('Fetching episode data from:', imageUrl);

    try {
        // Get the PNG image that contains episode data
        const base64Image = await getPngImage(imageUrl);
        
        // Try to decode the base64 image as text
        let jsonObject;
        try {
            const decodedString = Buffer.from(base64Image, 'base64').toString('utf-8');
            jsonObject = JSON.parse(decodedString);
        } catch (decodeError) {
            console.error('Failed to decode PNG data:', decodeError.message);
            return res.status(500).json({
                error: 'Failed to decode episode data',
                details: 'Episode data format may have changed or episode not found',
                episodeID: episodeID
            });
        }
        
        // Clean up the response object
        if (jsonObject.Type) delete jsonObject.Type;
        if (jsonObject.id) delete jsonObject.id;
        if (jsonObject.dataSaver) delete jsonObject.dataSaver;
        if (jsonObject.a) delete jsonObject.a;
        if (jsonObject.b) delete jsonObject.b;
        if (jsonObject.dType) delete jsonObject.dType;

        // Add referer
        jsonObject.Referer = API_HOST;

        console.log('Episode data processed successfully');

        // Get subtitles
        const subtitles = await getSubtitles(episodeID);

        const responseObject = {
            success: true,
            episodeID: episodeID,
            timestamp: new Date().toISOString(),
            sources: jsonObject,
            subtitles: subtitles
        };

        res.status(200).json(responseObject);
    } catch (error) {
        console.error('Error fetching episode source:', error.message);
        
        let errorMessage = 'Failed to fetch episode source';
        if (error.message.includes('timeout')) {
            errorMessage = 'Request timeout - kisskh.co may be slow or unavailable';
        } else if (error.message.includes('ENOTFOUND')) {
            errorMessage = 'Cannot connect to kisskh.co - check internet connection';
        } else if (error.response && error.response.status === 404) {
            errorMessage = 'Episode not found - please check the episode ID';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: error.message,
            episodeID: episodeID,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Test endpoint to check kisskh.co connectivity
app.get('/test', async (req, res) => {
    try {
        const testResponse = await axios.get('https://kisskh.co', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        res.json({
            status: 'kisskh.co is reachable',
            statusCode: testResponse.status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'kisskh.co is not reachable',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: 'Please check the API documentation at /api'
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'Something went wrong on our end'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Evisukh API Server is running on port ${PORT}`);
    console.log(`📱 Web interface: http://localhost:${PORT}`);
    console.log(`🔗 API documentation: http://localhost:${PORT}/api`);
    console.log(`💡 Usage: /api/:mediaID and /api/source/:episodeID`);
});
