var me = this; // Reference to the JavaScript API of this control
var ME = $('#' + me.UUID)[0]; // The root HTMLDivElement of this control

// Default values
const DEFAULT_LIBRARY_ROOT = "cmd";
const DEFAULT_LIBRARY_TYPES = ["rlib", "dylib"];
const DEFAULT_LIBRARY_DEPENDENCIES = "";

// Store current settings. The 'id' will be crucial.
me.currentSettings = {
    id: null, // Will be populated from ME.DATA.id
    libraryRoot: DEFAULT_LIBRARY_ROOT, // This is the key used internally in JS and for the input field
    libraryTypes: [...DEFAULT_LIBRARY_TYPES],
    libraryDependencies: DEFAULT_LIBRARY_DEPENDENCIES
};

// --- Helper: Snackbar for notifications ---
function showSnackbar(message, width = "400px", isError = false) {
    const displayMessage = isError ? "Error: " + message : message;
    if (document.body.api && document.body.api.ui && typeof document.body.api.ui.snackbarMsg === 'function') {
        document.body.api.ui.snackbarMsg(displayMessage, width);
    } else {
        console.log((isError ? "ERROR: " : "INFO: ") + displayMessage + " (Snackbar API not found)");
    }
}

/**
 * ready function, called when the control is initialized and ready.
 */
me.ready = function() {
    if (!ME) {
        console.error("Control root element not found for UUID: " + me.UUID);
        showSnackbar("Control initialization failed: Root element missing.", "500px", true);
        return;
    }
    var $controlRoot = $(ME);
    var $toggleLink = $controlRoot.find('.control-toggle-link');
    var $editorPanel = $controlRoot.find('#settings-editor-panel');
    var $libraryRootInput = $controlRoot.find('#libraryRoot'); // This input field's ID
    var $libraryTypeCheckboxes = $controlRoot.find('input[name="libraryType"]');
    var $libraryDependenciesTextarea = $controlRoot.find('#libraryDependencies');
    var $saveButton = $controlRoot.find('.save-button');
    var $cancelButton = $controlRoot.find('.cancel-button');

    if (!$toggleLink.length || !$editorPanel.length || !$libraryRootInput.length || !$libraryTypeCheckboxes.length || !$libraryDependenciesTextarea.length || !$saveButton.length || !$cancelButton.length) {
        console.error("One or more UI elements not found within the control. Check HTML structure and selectors.");
        showSnackbar("Control UI elements missing. Functionality may be impaired.", "500px", true);
    }

    /**
     * Populates the form fields with me.currentSettings.
     */
    function populateForm() {
        if ($libraryRootInput.length) {
            // The input field #libraryRoot is populated from me.currentSettings.libraryRoot
            $libraryRootInput.val(me.currentSettings.libraryRoot);
        }
        if ($libraryTypeCheckboxes.length) {
            $libraryTypeCheckboxes.each(function() {
                $(this).prop('checked', me.currentSettings.libraryTypes.includes($(this).val()));
            });
        }
        if ($libraryDependenciesTextarea.length) {
            $libraryDependenciesTextarea.val(me.currentSettings.libraryDependencies);
        }
    }

    /**
     * Loads settings from the server for the given library ID.
     * @param {string} libraryId - The ID of the library to load settings for.
     * @param {function} callback - Called with true on success, false on failure.
     */
    function loadSettingsFromServer(libraryId, callback) {
        if (!libraryId) {
            console.error("loadSettingsFromServer: libraryId is missing.");
            showSnackbar("Cannot load settings: Library ID not specified.", "500px", true);
            if (callback) callback(false);
            return;
        }

        console.log("Attempting to load settings for library ID:", libraryId);
        // showSnackbar("Loading settings for " + libraryId + "...", "300px"); // Commented out: Too noisy
        if (typeof send_get_library_config === 'function') {
            send_get_library_config(
                libraryId, // Pass the ID as a string
                function(result) {
                    if (result && result.status === "ok" && result.data) {
                        console.log("Settings loaded successfully from backend:", result.data);
                        me.currentSettings.id = result.data.id || libraryId;
                        me.currentSettings.libraryRoot = result.data.root || DEFAULT_LIBRARY_ROOT;
                        me.currentSettings.libraryTypes = result.data.library_types && Array.isArray(result.data.library_types) ? result.data.library_types : [...DEFAULT_LIBRARY_TYPES];
                        me.currentSettings.libraryDependencies = result.data.library_dependencies || DEFAULT_LIBRARY_DEPENDENCIES;
                        populateForm();
                        if (callback) callback(true);
                    } else {
                        const errorMessage = result && result.msg ? result.msg : "Unknown error occurred while loading.";
                        console.error("Error loading library configuration via backend:", errorMessage, result);
                        showSnackbar("Failed to load settings: " + errorMessage, "500px", true);
                        if (callback) callback(false);
                    }
                }
            );
        } else {
            console.warn("Backend function 'send_get_library_config' is not defined.");
            showSnackbar("Configuration Error: Cannot load settings, backend function missing.", "500px", true);
            if (callback) callback(false);
        }
    }

    /**
     * Toggles the visibility of the editor panel.
     * Loads/refreshes settings if opening and an ID is available.
     */
    function toggleEditor() {
        var isExpanded = $editorPanel.is(':visible');

        if (!isExpanded) {
            if (!me.currentSettings.id) {
                showSnackbar("Editor opened with default values. No specific library loaded.", "500px", true); // Keep: Warning/operational issue
                $editorPanel.slideDown();
                $toggleLink.attr('aria-expanded', 'true');
                $toggleLink.find('span').text('Hide Library Settings');
                return;
            }

            // showSnackbar("Refreshing settings for " + me.currentSettings.id + "...", "300px"); // Commented out: Too noisy
            loadSettingsFromServer(me.currentSettings.id, function(success) {
                if (!success) {
                     showSnackbar("Could not refresh settings. Displaying last known or defaults.", "500px", true); // Keep: Error/Warning
                }
                $editorPanel.slideDown();
                $toggleLink.attr('aria-expanded', 'true');
                $toggleLink.find('span').text('Hide Library Settings');
            });
        } else {
            $editorPanel.slideUp();
            $toggleLink.attr('aria-expanded', 'false');
            $toggleLink.find('span').text('Configure Library Settings');
        }
    }

    $toggleLink.on('click', function(e) {
        e.preventDefault();
        toggleEditor();
    });

    $saveButton.on('click', function() {
        if (!me.currentSettings.id) {
            console.error("Cannot save settings: Library ID is missing.");
            showSnackbar("Cannot save: Library ID not specified.", "500px", true); // Keep: Error
            return;
        }

        var newLibraryRoot = $libraryRootInput.val();
        var newLibraryTypes = [];
        $libraryTypeCheckboxes.filter(':checked').each(function() {
            newLibraryTypes.push($(this).val());
        });
        var newLibraryDependencies = $libraryDependenciesTextarea.val();

        const settingsData = {
            id: me.currentSettings.id,
            library_root: newLibraryRoot,
            library_types: newLibraryTypes,
            library_dependencies: newLibraryDependencies
        };

        console.log("Attempting to save settings:", settingsData);
        showSnackbar("Saving settings for " + me.currentSettings.id + "...", "300px"); // Keep: Saving to disk

        if (typeof send_save_library_config === 'function') {
            send_save_library_config(
                settingsData,
                function(result) {
                    if (result && result.status === "ok") {
                        const responseData = result.data || {};
                        console.log("Library configuration saved successfully via backend:", responseData);
                        me.currentSettings.libraryRoot = newLibraryRoot;
                        me.currentSettings.libraryTypes = newLibraryTypes;
                        me.currentSettings.libraryDependencies = newLibraryDependencies;
                        // showSnackbar(responseData.message || "Settings saved successfully!", "400px"); // Commented out: Too noisy for success
                        toggleEditor();
                    } else {
                        const errorMessage = result && result.msg ? result.msg : "Unknown error occurred.";
                        console.error("Error saving library configuration via backend:", errorMessage, result);
                        showSnackbar("Failed to save settings: " + errorMessage, "500px", true); // Keep: Error
                    }
                }
            );
        } else {
            console.warn("Backend function 'send_save_library_config' is not defined.");
            showSnackbar("Configuration Error: Cannot save settings, backend function missing.", "500px", true); // Keep: Error
        }
    });

    $cancelButton.on('click', function() {
        populateForm();
        if ($editorPanel.is(':visible')) {
            toggleEditor();
        }
    });

    populateForm();

    if (ME.DATA && ME.DATA.id) {
        me.currentSettings.id = ME.DATA.id;
        console.log("Library ID loaded from ME.DATA.id:", me.currentSettings.id);
        // showSnackbar("Loading settings for " + me.currentSettings.id + "...", "300px"); // Commented out: Too noisy
        loadSettingsFromServer(me.currentSettings.id, function(success) {
            if (success) {
                // showSnackbar("Settings loaded for " + me.currentSettings.id + ".", "400px"); // Commented out: Too noisy
            } else {
                showSnackbar("Initial load failed for " + me.currentSettings.id + ". Editor will use defaults.", "500px", true); // Keep: Error
            }
        });
    } else {
        console.warn("ME.DATA.id not found at startup. Control will use default settings. Saving will be disabled until an ID is available.");
        showSnackbar("Library ID not available at startup. Editor uses default settings. Saving disabled.", "500px", true); // Keep: Error/Warning
    }

    if ($editorPanel.is(':hidden')) {
        $toggleLink.find('span').text('Configure Library Settings');
        $toggleLink.attr('aria-expanded', 'false');
    } else {
        $toggleLink.find('span').text('Hide Library Settings');
        $toggleLink.attr('aria-expanded', 'true');
    }

    console.log("Library Settings Control ready. UUID: " + me.UUID);
};
