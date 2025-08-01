<!-- index.html -->
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>dehsurc.github.io</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1>dehsurc</h1>
    <nav>
      <ul>
        <li><a href="#about">소개</a></li>
        <li><a href="#contact">연락처</a></li>
      </ul>
    </nav>
  </header>

  <main class="profile-container">
    <div class="profile-text">
      <h2>이름</h2>
      <p>간단한 한 줄 소개를 여기에 넣으세요.</p>
      <!-- B: 연락처 -->
      <section id="contact">
        <h3>연락처</h3>
        <ul>
          <li>Email: you@example.com</li>
          <li>GitHub: <a href="#">github.com/dehsurc</a></li>
          <li>LinkedIn: <a href="#">linkedin.com/in/yourname</a></li>
        </ul>
      </section>
    </div>
    <!-- A: 사진 -->
    <div class="profile-photo">
      <img src="path/to/your-photo.jpg" alt="프로필 사진" />
    </div>
  </main>

  <footer>
    <p>© 2025 dehsurc.github.io</p>
  </footer>
</body>
</html>


/* style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Noto Sans KR', sans-serif;
  color: #333;
  line-height: 1.6;
}
header {
  background: #222;
  color: #fff;
  padding: 1rem;
  text-align: center;
}
nav ul { list-style: none; display: flex; justify-content: center; }
nav li { margin: 0 1rem; }
nav a { color: #fff; text-decoration: none; }
.profile-container {
  display: flex;
  flex-wrap: wrap;
  max-width: 900px;
  margin: 2rem auto;
  gap: 2rem;
}
.profile-text {
  flex: 1 1 400px;
}
.profile-text h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
.profile-text p {
  margin-bottom: 1.5rem;
}
.profile-text #contact h3 {
  margin-top: 2rem;
  margin-bottom: 0.5rem;
  font-size: 1.2rem;
  border-bottom: 2px solid #ddd;
  display: inline-block;
}
.profile-text #contact ul {
  list-style: none;
  margin-top: 0.5rem;
}
.profile-text #contact li {
  margin-bottom: 0.5rem;
}
.profile-photo {
  flex: 0 0 250px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-photo img {
  max-width: 100%;
  border-radius: 8px;
}
footer {
  text-align: center;
  padding: 1rem 0;
  background: #222;
  color: #ccc;
  margin-top: 2rem;
}
a { color: #007acc; }
