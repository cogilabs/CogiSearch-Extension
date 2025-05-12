document.addEventListener('click', function(event) {
  if (event.target.classList.contains('clickToCopy')) {
    const copyText = event.target.textContent;
    navigator.clipboard.writeText(copyText)
      .then(() => {
        showNotification();
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  }
});

function showNotification() {
  const notification = document.getElementById('copyNotification');
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 2000);
}