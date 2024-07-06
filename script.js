// Select the element where time will be displayed
const timeElement = document.querySelector('.time');

// Function to update the time display with short format (hour and minute)
function updateTime() {
  try {
    const now = new Date();
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const shortTime = now.toLocaleTimeString('en-US', options);
    timeElement.innerHTML = shortTime;
  } catch (error) {
    console.error('Error updating time:', error);
  }
}

// Function to show detailed time format on mouse enter
function showLongTime() {
  try {
    const now = new Date();
    const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true };
    const longTime = now.toLocaleDateString('en-US', options);
    timeElement.classList.add('time-long');
    timeElement.textContent = longTime;
  } catch (error) {
    console.error('Error showing long time:', error);
  }
}

// Function to revert to short time format on mouse leave
function hideLongTime() {
  try {
    const now = new Date();
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    const shortTime = now.toLocaleTimeString('en-US', options);
    timeElement.classList.remove('time-long');
    timeElement.innerHTML = shortTime;
  } catch (error) {
    console.error('Error hiding long time:', error);
  }
}

// Update the time initially and then every 5 seconds
updateTime(); // Call once to initialize
setInterval(updateTime, 5000); // Update every 5 seconds

// Event listeners to show/hide detailed time format on hover
timeElement.addEventListener('mouseenter', showLongTime);
timeElement.addEventListener('mouseleave', hideLongTime);
