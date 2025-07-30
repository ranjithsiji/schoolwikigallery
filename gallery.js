 // Configuration
        const config = {
            schoolCode: "14009",
            districtCode: "KGD",
            activities: ["KOODE", "CAMP", "TREE", "BLOO", "CLEN"], // KOODE first as default
            maxImages: 5,
            apiUrl: "https://schoolwiki.in/api.php",
            imageBaseUrl: "https://schoolwiki.in/images/",
            thumbnailWidth: 300 // Width for thumbnail requests
        };
        // Global callback counter
        let jsonpCallbackCount = 0;

        // Initialize the gallery when page loads
        $(document).ready(function () {
            initGallery();
        });

        // Initialize the gallery
        async function initGallery() {
            try {
                // Create dropdown selector for activities
                createActivityDropdown();

                // Set KOODE as default selected
                $('#activitySelect').val('KOODE');

                // Load KOODE images by default
                await loadAndDisplayActivity('KOODE');
            } catch (error) {
                console.error('Error initializing gallery:', error);
                showError('Failed to load gallery. Please try again later.');
            }
        }

        // Create dropdown selector for activities
        function createActivityDropdown() {
            const $select = $('#activitySelect');

            // Add all activities to dropdown
            config.activities.forEach(activity => {
                $select.append(
                    $('<option>').val(activity).text(activity)
                );
            });

            // Add "All" option at the end
            $select.append(
                $('<option>').val('all').text('All Activities')
            );

            // Handle selection change
            $select.on('change', async function () {
                const activity = $(this).val();
                try {
                    if (activity === 'all') {
                        await loadAllActivities();
                    } else {
                        await loadAndDisplayActivity(activity);
                    }
                } catch (error) {
                    console.error('Error loading activity:', error);
                    showError(`Failed to load ${activity} activities. Please try again.`);
                }
            });
        }

        // Load and display a specific activity
        async function loadAndDisplayActivity(activity) {
            showLoading(`Loading ${activity} activities...`);

            // Clear previous images
            $('#nssGallery').empty();
            $('#currentActivity').text(`Loading ${activity} Activities...`);

            // Load fresh images for this activity
            const images = await loadActivityImages(activity);

            // Display the images
            displayImages(images, activity);

            // Update header
            $('#currentActivity').text(`Showing ${activity} Activities (${images.length} images)`);
            $('#loadingMessage').hide();
        }

        // Load all activities (for "All" option)
        async function loadAllActivities() {
            showLoading('Loading all activities...');

            // Clear previous images
            $('#nssGallery').empty();
            $('#currentActivity').text('Loading All Activities...');

            // Load fresh images for all activities
            const allPromises = config.activities.map(activity =>
                loadActivityImages(activity)
            );

            const allResults = await Promise.all(allPromises);
            const allImages = allResults.flat();

            // Display all images
            displayImages(allImages, 'all');

            // Update header
            $('#currentActivity').text(`Showing All Activities (${allImages.length} images)`);
            $('#loadingMessage').hide();
        }

        // Load images for a specific activity (always fresh)
        async function loadActivityImages(activity) {
            const activityImages = [];
            const promises = [];

            for (let i = 1; i <= config.maxImages; i++) {
                const num = i.toString().padStart(2, '0');
                const filename = `NSS2025-${config.schoolCode}-${config.districtCode}-${activity}-${num}.jpg`;

                promises.push(
                    getThumbnailUrl(filename)
                        .then(thumbnailUrl => {
                            if (thumbnailUrl) {
                                activityImages.push({
                                    thumbnailUrl: thumbnailUrl,
                                    fullUrl: config.imageBaseUrl + filename,
                                    activity: activity,
                                    number: i,
                                    filename: filename
                                });
                            }
                        })
                        .catch(error => {
                            console.error(`Error checking image ${filename}:`, error);
                        })
                );
            }

            await Promise.all(promises);
            return activityImages;
        }

        // Get thumbnail URL for an image using MediaWiki API with proper JSONP handling
        function getThumbnailUrl(filename) {
            return new Promise((resolve, reject) => {
                const callbackName = `jsonpCallback_${jsonpCallbackCount++}`;

                // Create temporary callback function
                window[callbackName] = function (data) {
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

                // Create script tag for JSONP request
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

        // Display images in the gallery
        function displayImages(images, activity) {
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
                    .on('load', function () {
                        $loadingText.remove();
                    })
                    .on('error', function () {
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

        // Show loading state
        function showLoading(message) {
            $('#loadingMessage').text(message).show();
            $('#errorMessage').hide();
        }

        // Show error message
        function showError(message) {
            $('#loadingMessage').hide();
            $('#errorMessage').text(message).show();
        }