      function updateTime() {
        var now = new Date();
        var options = { timeZone: 'Africa/Nairobi' };
        var eatTime = now.toLocaleTimeString('en-US', options);
        var date = now.toDateString();
        var timeString = date + ' ' + eatTime;
        document.getElementById('current-time').textContent = timeString;
      }
      
      setInterval(updateTime, 1000);
