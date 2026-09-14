const repoOwner = 'AstrialHolloway';
const repoName = 'South-Tech-Web-and-Computer-Programming';

fetch(`https://github.com{repoOwner}/${repoName}`)
  .then(response => response.json.json()) // or response.json()
  .then(data => {
    const updateDate = new Date(data.updated_at);
    const now = new Date();
    const diffTime = Math.abs(now - updateDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    document.getElementById('update-date').innerText = `${diffDays} days ago`;
  })
  .catch(error => console.error('Error fetching repo data:', error));