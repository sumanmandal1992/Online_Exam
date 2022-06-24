let time = parseInt(document.getElementById('time').value, 10);


const timer = document.getElementById('timer');
const nexttimeval = document.getElementById('nexttime');
const prevtimeval = document.getElementById('prevtime');
const submittimeval = document.getElementById('submittime');

const timeStat = sessionStorage.getItem('time');
if (timeStat > 0) time = timeStat;
if (timeStat < 0) time = 0;
const interval = setInterval(countDown, 1000);

function countDown() {
    let hour = Math.floor(time / 3600);
    if (hour < 10) hour = '0' + hour;
    let min = Math.floor(time / 60);
    if (min < 10) min = '0' + min;
    let sec = time % 60;
    if (sec < 10) sec = '0' + sec;

    timer.innerHTML = `${hour}:${min}:${sec}`;
    if (time <= 0) {
        clearInterval(interval);
        time = 0;
    }
    time--;
    sessionStorage.setItem('time', time);

    nexttimeval.setAttribute('value', time.toString());
    prevtimeval.setAttribute('value', time.toString());
    submittimeval.setAttribute('value', time.toString());
}