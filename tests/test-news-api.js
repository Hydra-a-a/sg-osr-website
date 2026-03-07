fetch('http://localhost:3000/api/news')
    .then(res => res.json())
    .then(data => {
        console.log("Response from /api/news:");
        console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => console.error("Fetch error:", err));
