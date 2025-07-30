// Configuration
    const config = {
        activities: ["KOODE", "NTDC", "CAMP"], // Example activity codes
        maxImages: 20,
        apiUrl: "https://schoolwiki.in/api.php",
        imageBaseUrl: "https://schoolwiki.in/images/",
        thumbnailWidth: 300
    };

    // Global callback counter
    let jsonpCallbackCount = 0;

    // Initialize the page when DOM is ready
    $(document).ready(function() {
        initializePage();
    });

    function initializePage() {
        // Populate activity dropdown
        const $activitySelect = $('#activitySelect');
        config.activities.forEach(activity => {
            $activitySelect.append($('<option>').val(activity).text(activity));
        });
        $activitySelect.append($('<option>').val('all').text('All Activities'));
        $activitySelect.val('KOODE');
        
        // Set up search button
        $('#searchBtn').on('click', function() {
            loadGallery();
        });
        
        // Enable pressing Enter in school code field to trigger search
        $('#schoolCode').on('keypress', function(e) {
            if (e.which === 13) { // Enter key
                loadGallery();
            }
        });
    }

    async function loadGallery() {
        try {
            // Get current values from form
            const schoolCode = $('#schoolCode').val().trim();
            const districtCode = $('#districtCode').val();
            const activity = $('#activitySelect').val();
            
            // Validate school code
            if (!schoolCode || !/^\d+$/.test(schoolCode)) {
                showError('Please enter a valid school code (numbers only)');
                return;
            }
            
            showLoading(`Loading ${activity} activities for school ${schoolCode}...`);
            $('#nssGallery').empty();
            
            // Update config with current selections
            const currentConfig = {
                ...config,
                schoolCode: schoolCode,
                districtCode: districtCode
            };
            
            if (activity === 'all') {
                await loadAllActivities(currentConfig);
            } else {
                await loadAndDisplayActivity(activity, currentConfig);
            }
            
            $('#loadingMessage').hide();
        } catch (error) {
            console.error('Error loading gallery:', error);
            showError('Failed to load gallery. Please try again later.');
        }
    }

    async function loadAndDisplayActivity(activity, config) {
        $('#currentActivity').text(`Loading ${activity} Activities...`);
        
        const images = await loadActivityImages(activity, config);
        displayImages(images, activity, config);
        
        $('#currentActivity').text(
            `Showing ${activity} Activities for School ${config.schoolCode} (${images.length} images)`
        );
    }

    async function loadAllActivities(config) {
        $('#currentActivity').text('Loading All Activities...');
        
        const allPromises = config.activities.map(activity => 
            loadActivityImages(activity, config)
        );
        
        const allResults = await Promise.all(allPromises);
        const allImages = allResults.flat();
        
        displayImages(allImages, 'all', config);
        
        $('#currentActivity').text(
            `Showing All Activities for School ${config.schoolCode} (${allImages.length} images)`
        );
    }

    async function loadActivityImages(activity, config) {
        const activityImages = [];
        const promises = [];
        
        for (let i = 1; i <= config.maxImages; i++) {
            const num = i.toString().padStart(2, '0');
            const filename = `NSS2025-${config.schoolCode}-${config.districtCode}-${activity}-${num}.jpg`;
            
            // Add small delay between requests to avoid overwhelming server
            if (i > 1) await new Promise(resolve => setTimeout(resolve, 100));
            
            try {
                const thumbUrl = await getThumbnailUrl(filename, config);
                if (thumbUrl) {
                    activityImages.push({
                        thumbnailUrl: thumbUrl,
                        fullUrl: config.imageBaseUrl + filename,
                        activity: activity,
                        number: i,
                        filename: filename
                    });
                }
            } catch (error) {
                console.error(`Error checking image ${filename}:`, error);
            }
        }
        
        return activityImages;
    }

    function getThumbnailUrl(filename, config) {
        return new Promise((resolve, reject) => {
            const callbackName = `jsonpCallback_${jsonpCallbackCount++}`;
            
            window[callbackName] = function(data) {
                delete window[callbackName];
                document.body.removeChild(script);
                
                try {
                    const pages = data.query.pages;
                    const pageId = Object.keys(pages)[0];
                    
                    if (pageId !== "-1" && pages[pageId].imageinfo) {
                        const thumbUrl = pages[pageId].imageinfo[0].thumburl || 
                                        pages[pageId].imageinfo[0].url;
                        resolve(thumbUrl);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            };

            const script = document.createElement('script');
            const params = new URLSearchParams({
                action: 'query',
                titles: `File:${filename}`,
                prop: 'imageinfo',
                iiprop: 'url',
                iiurlwidth: config.thumbnailWidth,
                format: 'json',
                callback: callbackName
            });

            script.src = `${config.apiUrl}?${params.toString()}`;
            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('JSONP request failed'));
            };

            document.body.appendChild(script);
        });
    }

    function displayImages(images, activity, config) {
        const $gallery = $('#nssGallery').empty();
        
        if (!images || images.length === 0) {
            $gallery.append('<p class="loading">No images found for this activity.</p>');
            return;
        }
        
        images.forEach(img => {
            const $item = $('<div>').addClass('gallery-item');
            
            const $thumbContainer = $('<div>').addClass('thumbnail-container');
            const $loadingText = $('<div>').addClass('thumbnail-loading').text('Loading...');
            const $image = $('<img>')
                .addClass('gallery-image')
                .attr('src', img.thumbnailUrl)
                .attr('alt', `NSS Activity ${img.activity} - Image ${img.number}`)
                .attr('loading', 'lazy')
                .on('load', function() {
                    $loadingText.remove();
                })
                .on('error', function() {
                    $loadingText.text('Image failed to load');
                });
            
            $thumbContainer.append($loadingText, $image);
            
            const $caption = $('<div>').addClass('gallery-caption');
            
            const $title = $('<div>')
                .addClass('activity-title')
                .text(`Activity: ${img.activity}`);
            
            const $number = $('<div>')
                .addClass('image-number')
                .text(`Image ${img.number}`);
            
            $caption.append($title, $number);
            $item.append($thumbContainer, $caption);
            $gallery.append($item);
        });
    }

    function showLoading(message) {
        $('#loadingMessage').text(message).show();
        $('#errorMessage').hide();
    }

    function showError(message) {
        $('#loadingMessage').hide();
        $('#errorMessage').text(message).show();
    }