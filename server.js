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

// Helper functions
const getMediaInfo = async (mediaID) => {
    const url = `${API_INFO}${mediaID}`;
    console.log('Fetching media info from:', url);
    const response = await axios.get(url);
    return response.data;
};

const getPngImage = async (imageUrl) => {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
        });
        const base64Image = Buffer.from(response.data).toString('base64');
        return base64Image;
    } catch (error) {
        throw new Error(`Failed to fetch image: ${error.message}`);
    }
};

const getSubtitles = async (subID) => {
    const url = `https://kisskh.co/api/Sub/${subID}`;
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.log('Subtitles fetch error:', error.message);
        return { error: 'Subtitles not available' };
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
                error: 'Media not found. Please check the ID and try again.' 
            });
        }

        res.status(200).json({
            success: true,
            data: mediaInfo,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching media info:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch media information',
            details: error.message
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
        const decodedString = Buffer.from(base64Image, 'base64').toString('utf-8');
        const jsonObject = JSON.parse(decodedString);
        
        // Clean up the response object
        delete jsonObject.Type;
        delete jsonObject.id;
        delete jsonObject.dataSaver;
        delete jsonObject.a;
        delete jsonObject.b;
        delete jsonObject.dType;

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
        res.status(500).json({ 
            error: 'Failed to fetch episode source',
            details: error.message,
            episodeID: episodeID
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
