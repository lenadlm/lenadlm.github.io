function updateTime() {
  const date = new Date();
  const options = {
    timeZone: 'Africa/Nairobi',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  };
  const timeString = date.toLocaleString('en-US', options);
  const navbarElement = document.getElementById('navbar-time');
  navbarElement.innerHTML = timeString;
}

setInterval(updateTime, 1000);
