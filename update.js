const repoOwner = 'AstrialHolloway';
const repoName = 'South-Tech-Web-and-Computer-Programming';

// FIX: Make sure this exact structure is used with backticks (`)
fetch(`https://github.com/${repoOwner}/${repoName}`)
  .then(response => {
    if (!response.ok) {
      throw new Error(`GitHub API returned status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    const updateDate = new Date(data.pushed_at); 
    const now = new Date();
    const diffTime = Math.abs(now - updateDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const dayText = diffDays === 1 ? 'day' : 'days';
    document.getElementById('update-date').innerText = `${diffDays} ${dayText} ago`;
  })
  .catch(error => {
    document.getElementById('update-date').innerText = 'unknown';
    console.error('Error fetching repo data:', error);
  });