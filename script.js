class Mapper {
    // Handles the async geolocation API call for user's position. Exposes an async function to display map on current position and return the map object for further use
    constructor() {
        this.locationPromise = this.createLocationPromise();     
    }

    createLocationPromise() {
        // returns new promise containing the user's position retrieved through Geolocation API
        return new Promise( (resolve, reject)=>{
        // create new promise from the promise returned by Geolocation API
        navigator.geolocation.getCurrentPosition(
            function(position) {
                // .getCurrentPosition returns an object with lat, long, timestamp and a plethora of other data
                const positionLat = position.coords.latitude
                const positionLong = position.coords.longitude
                // use promise.resolve() to return an object with lat and long - we only need these 2
                resolve({positionLat, positionLong})
                },
            function(geoError) {
                // .getCurrentPosition has a 2nd built-in function to return an error code if user blocks location in browser. We capture the error object in a geoError variable and return it with promise.reject()
                reject(geoError)
                }
            )
        })
    }

    async displayMap() {
        // consumes the location promise to create a leaflet map object and return it to the global scope
        try {
            // consume location promise. We use object destructuring to assign the 2 returned values to local variables
            const {positionLat, positionLong} = await this.locationPromise;
            // create a new Leaflet map, add tiles 
            const map = L.map('map').setView([positionLat, positionLong], 16);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);
            return map
        }
        catch (resolutionError) {
            // if the user blocks location access log the Leaflet error and alert user
            console.log(resolutionError)
            alert("Could not establish your location")
        }
    }
}

class Activity {
    constructor(location, type) {
        this.location = location;        
        this.type = type;  
        this.id = null;        
        this.date = null;        
        this.marker = null;   
    }

    assignDateID() {
        // create a simplified unique ID - unix time of creation and assign date of creation
        this.id = Temporal.Now.instant().epochMilliseconds
        this.date = Temporal.Now.plainDateISO().toLocaleString("en-pl", {year:"numeric", day:"numeric", month:"long"})
    }

    createMarker() {
        this.marker = L.marker(...this.location);

        const popupContent = `${(this.type === "walk" ? "👟 A walk" : "🚗 A Trip")} on ${this.date}`
        
        this.marker.bindPopup(popupContent,
            {closeOnClick: false, autoClose: false})
    }
}

class Walk extends Activity {
    constructor(location, type, duration, sleep, walked) {
        super(location, type);
        this.duration = duration;
        this.sleep = sleep;
        this.walked = walked;
    }
}

class Trip extends Activity {
    constructor(location, type, length, environment) {
        super(location, type);
        this.length = length;
        this.environment = environment;
    }
}


class IMTApp {
    constructor(map) {
        this.map = map;
        this.activities = [];
        // temp array with data for new activity instance (don't have a better idea for gathering information across multiple methods that eventually gets used for new activity instance creation)
        this.newActivityLocation = [];
        
        this.cacheElements();
        this.assignEventListeners();
    }

    cacheElements() {
        // Form input elements
        this.activityForm = document.getElementById("activity-form")
        this.activityTypeDropdown = document.getElementById("activity-type-dropdown")
        this.activityDurationInput = document.getElementById("activity-duration-input")
        this.activitySleepInput = document.getElementById("sleep-input")
        this.activityWalkedInput = document.getElementById("walked-input")
        this.activityEnvTypeDropdown = document.getElementById("environment-type-dropdown")
        this.activityTripLengthInput = document.getElementById("trip-length-input")
        this.activityFormButtonsContainer = document.getElementById("form-buttons-container")
        this.buttonNewActivityCancel = document.getElementById("button-new-record-cancel")
        this.buttonNewActivityAdd = document.getElementById("button-add-new-record")
        this.activityFormInputsAll = [this.activityDurationInput, this.activitySleepInput, this.activityWalkedInput, this.activityEnvTypeDropdown, this.activityTripLengthInput]
        this.activityFormInputsWalk = [this.activityDurationInput, this.activitySleepInput, this.activityWalkedInput]
        this.activityFormInputsTrip = [this.activityEnvTypeDropdown, this.activityTripLengthInput]

        // Activities List & element template
        this.activitiesList = document.getElementById("activities-list");
        this.walkRecordTemplate = document.getElementById("template-record-walk");
        this.tripRecordTemplate = document.getElementById("template-record-trip");
    }

    assignEventListeners() {
        this.activityTypeDropdown.addEventListener("change", this.showForm.bind(this))
        
        this.activityForm.addEventListener("submit", this.addNewActivity.bind(this))
        this.buttonNewActivityCancel.addEventListener("click", this.cancelAddingNewActivity.bind(this))
        
        this.map.on("click", this.showActivityTypeDropdown.bind(this))
        // pan to map marker on activity record list item click 
        this.activitiesList.addEventListener("click", this.panToPopup.bind(this))
    }

    showForm(event) {
        // check which activity type is selected and show appropriate form
        // get selected activity index
        const activityTypeName = event.target.value
        // show button for both activity types
        this.activityFormButtonsContainer.classList.remove("activity-form-input-hidden")

        if (activityTypeName === "walk") {
            // show Walk form
            for (const activityFormInput of this.activityFormInputsAll) {
                if (this.activityFormInputsWalk.includes(activityFormInput)) {
                    // we have to remove the base class cause display grid overrides display none
                    activityFormInput.classList.remove("activity-form-input-hidden")
                    activityFormInput.classList.add("activity-form-input")
                }
                else if (!this.activityFormInputsWalk.includes(activityFormInput)) {
                    // hide trip form
                    activityFormInput.classList.add("activity-form-input-hidden")
                    activityFormInput.classList.remove("activity-form-input")
                }
            }
        }
        else if (activityTypeName === "trip") {
            // show Trip form
            for (const activityFormInput of this.activityFormInputsAll) {
                if (this.activityFormInputsTrip.includes(activityFormInput)) {
                    activityFormInput.classList.remove("activity-form-input-hidden")
                    activityFormInput.classList.add("activity-form-input")
                }
                else if (!this.activityFormInputsTrip.includes(activityFormInput)) {
                    // hide walk form
                    activityFormInput.classList.add("activity-form-input-hidden")
                    activityFormInput.classList.remove("activity-form-input")
                }
            }
        }
    }

    addNewActivity(event) {
        // form submission
        event.preventDefault()
        // cool built-in function to check validity of each form field and show prompt to the user
        this.activityForm.reportValidity()

        // Create a new activity instance, add marker to map. Store new activity in storage array
        const activityTypeName = this.activityTypeDropdown.querySelector("select").value;
        this.activities.push(this.instantiateActivity(activityTypeName));
        this.activities.at(-1).marker.addTo(this.map).openPopup();
        this.addActivityRecord(this.activities.at(-1))

        // reset and hide form
        this.resetForm();
    }

    instantiateActivity(activityTypeName) {
        if (activityTypeName === "walk") {
            // read from this.activityFormInputsWalk list
            const newActivity = new Walk(
                this.newActivityLocation,
                activityTypeName, 
                this.activityDurationInput.querySelector("input").value, 
                this.activitySleepInput.querySelector("input").value, 
                this.activityWalkedInput.querySelector("input").value
            )
            newActivity.assignDateID();
            newActivity.createMarker();
            // clear the temp location array storage
            this.newActivityLocation = []
            return newActivity
        }
        else if (activityTypeName === "trip") {
            // read from this.activityFormInputsTrip list
            const newActivity = new Trip(
                this.newActivityLocation,
                activityTypeName,
                this.activityTripLengthInput.querySelector("input").value,
                this.activityEnvTypeDropdown.querySelector("select").value
            )
            newActivity.assignDateID();
            newActivity.createMarker();
            // clear the temp location array storage
            this.newActivityLocation = []
            return newActivity
        }
    }

    resetForm() {
        // clear input field
        this.activityTypeDropdown.selectedIndex = 0;
        this.activityForm.reset()
        // hide input fields
        for (const activityFormInput of this.activityFormInputsAll) {
            activityFormInput.classList.add("activity-form-input-hidden")
            activityFormInput.classList.remove("activity-form-input")
        }
        // hide buttons
        this.activityFormButtonsContainer.classList.add("activity-form-input-hidden")

        // hide the entire form
        this.activityForm.classList.add("activity-form-input-hidden");
    }
    
    cancelAddingNewActivity(event) {
        // cancel adding new activity. Hide the form and remove the marker from map
        event.preventDefault()
        this.activityForm.classList.add("activity-form-input-hidden")
        this.resetForm()
        // remove the map marker associated with the activity being canceled that was just created
        this.markers.at(-1).remove() 
        this.markers.pop()
        console.log(`removed marker`)
        console.log(this.markers)
    }

    showActivityTypeDropdown(event) {
        // user clicked on map -> log the click location
        console.log(event.latlng)
        const {lat, lng:long} = event.latlng;
        // store location for new activity instance
        this.newActivityLocation.push([lat, long])        
        // user clicked on map -> show type dropdown
        this.activityForm.classList.remove("activity-form-input-hidden");
    }

    addActivityRecord(activity) {
        let templateContent;
        if (activity.type === "walk") {
            templateContent = this.walkRecordTemplate.content.cloneNode(true)
            // setting activity date
            templateContent.querySelector("h2 time").textContent = activity.date;            
            // setting activity information
            const infoDisplayElements = templateContent.querySelectorAll("p span");
            infoDisplayElements[0].textContent = activity.duration
            infoDisplayElements[1].textContent = activity.sleep
            infoDisplayElements[2].textContent = activity.walked
            // setting the data-activity-id value to that of the activity instance
            const activityListItem = templateContent.querySelector("li[data-activity-id]")
            activityListItem.dataset["activityId"] = activity.id;
        }
        else if (activity.type === "trip") {
            templateContent = this.tripRecordTemplate.content.cloneNode(true)
            // setting activity date
            templateContent.querySelector("h2 time").textContent = activity.date;            
            // setting activity information
            const infoDisplayElements = templateContent.querySelectorAll("p span");
            infoDisplayElements[0].textContent = activity.length
            infoDisplayElements[1].textContent = activity.environment
            // setting the data-activity-id value to that of the activity instance
            const activityListItem = templateContent.querySelector("li[data-activity-id]")
            activityListItem.dataset["activityId"] = activity.id;
        }
        this.activitiesList.prepend(templateContent)
    }

    panToPopup(event) {
        // user clicked somewhere on the activities list. Check if they clicked on an actual activity record
        const activityRecord = event.target.closest("li.activity-record")
        if (activityRecord) {
            // is they clicked on the record read that activities' ID
            const activityRecordID = Number(activityRecord.dataset["activityId"]);
            // find the corresponding activity instance in the activities storage array and get its map coordinates
                // declaring destination coords variable outside the for loop to have access to it when we exit the for loops' scope
            let destinationCoordinates;
            for (const activity of this.activities) {
                if (activity.id === activityRecordID) {
                    destinationCoordinates = activity.location; 
                }
            }
            // pan map to correct marker
            this.map.setView(...destinationCoordinates, 17, {animate: true, duration: 1});
        }
    }
}

const mapper0 = new Mapper()
const map = await mapper0.displayMap()
const imtApp0 = new IMTApp(map)