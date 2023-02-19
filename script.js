const timeElement = document.querySelector('.time');

function updateTime() {
  const now = new Date();
  const options = { hour: 'numeric', minute: 'numeric', hour12: true };
  const shortTime = now.toLocaleTimeString('en-US', options);
  timeElement.innerHTML = shortTime;
}

function showLongTime() {
  const now = new Date();
  const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true };
  const longTime = now.toLocaleDateString('en-US', options);
  timeElement.classList.add('time-long');
  timeElement.textContent = longTime;
}

function hideLongTime() {
  const now = new Date();
  const options = { hour: 'numeric', minute: 'numeric', hour12: true };
  const shortTime = now.toLocaleTimeString('en-US', options);
  timeElement.classList.remove('time-long');
  timeElement.innerHTML = shortTime;
}

// update the time every 5 seconds
setInterval(updateTime, 5000);

// add event listeners to show/hide long time
timeElement.addEventListener('mouseenter', showLongTime);
timeElement.addEventListener('mouseleave', hideLongTime);