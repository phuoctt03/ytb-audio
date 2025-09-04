class YouTubeAudioPlayer {
  constructor() {
    this.player = null
    this.isPlaying = false
    this.isAudioMode = false
    this.currentTime = 0
    this.duration = 0
    this.volume = 100
    this.isDragging = false

    this.initializeElements()
    this.bindEvents()
    this.initializeTheme()
  }

  initializeElements() {
    // Input elements
    this.urlInput = document.getElementById("urlInput")
    this.loadBtn = document.getElementById("loadBtn")

    // Control elements
    this.playBtn = document.getElementById("playBtn")
    this.prevBtn = document.getElementById("prevBtn")
    this.nextBtn = document.getElementById("nextBtn")
    this.audioModeBtn = document.getElementById("audioModeBtn")
    this.volumeBtn = document.getElementById("volumeBtn")
    this.volumeRange = document.getElementById("volumeRange")

    // Progress elements
    this.progressBar = document.getElementById("progressBar")
    this.progressFill = document.getElementById("progressFill")
    this.progressThumb = document.getElementById("progressThumb")
    this.currentTimeEl = document.getElementById("currentTime")
    this.durationEl = document.getElementById("duration")

    // Display elements
    this.videoWrapper = document.getElementById("videoWrapper")
    this.audioOverlay = document.getElementById("audioOverlay")
    this.trackTitle = document.getElementById("trackTitle")
    this.trackArtist = document.getElementById("trackArtist")
    this.statusDisplay = document.getElementById("statusDisplay")
    this.themeToggle = document.getElementById("themeToggle")
  }

  bindEvents() {
    // Load button
    this.loadBtn.addEventListener("click", () => this.loadVideo())
    this.urlInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.loadVideo()
    })

    // Control buttons
    this.playBtn.addEventListener("click", () => this.togglePlay())
    this.prevBtn.addEventListener("click", () => this.previousVideo())
    this.nextBtn.addEventListener("click", () => this.nextVideo())
    this.audioModeBtn.addEventListener("click", () => this.toggleAudioMode())

    // Volume control
    this.volumeBtn.addEventListener("click", () => this.toggleMute())
    this.volumeRange.addEventListener("input", (e) => this.setVolume(e.target.value))

    // Progress bar
    this.progressBar.addEventListener("click", (e) => this.seekTo(e))
    this.progressBar.addEventListener("mousedown", () => (this.isDragging = true))
    document.addEventListener("mouseup", () => (this.isDragging = false))
    this.progressBar.addEventListener("mousemove", (e) => {
      if (this.isDragging) this.seekTo(e)
    })

    // Theme toggle
    this.themeToggle.addEventListener("click", () => this.toggleTheme())

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyboard(e))
  }

  initializeTheme() {
    const savedTheme = localStorage.getItem("theme") || "light"
    document.documentElement.setAttribute("data-theme", savedTheme)
    this.themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙"
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    document.documentElement.setAttribute("data-theme", newTheme)
    localStorage.setItem("theme", newTheme)
    this.themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙"
  }

  loadVideo() {
    const url = this.urlInput.value.trim()
    if (!url) {
      this.updateStatus("Vui lòng nhập link YouTube!", "error")
      return
    }

    this.loadBtn.classList.add("loading")
    this.updateStatus("Đang tải video...", "loading")

    const { videoId, playlistId } = this.parseYouTubeUrl(url)

    if (!videoId && !playlistId) {
      this.updateStatus("Link YouTube không hợp lệ!", "error")
      this.loadBtn.classList.remove("loading")
      return
    }

    if (this.player) {
      if (playlistId) {
        this.player.loadPlaylist({
          list: playlistId,
          index: 0,
          suggestedQuality: "default",
        })
      } else {
        this.player.loadVideoById(videoId)
      }
    } else {
      this.initializePlayer(videoId, playlistId)
    }
  }

  parseYouTubeUrl(url) {
    let videoId = null
    let playlistId = null

    // Check if it's just a video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      videoId = url
    } else {
      try {
        const urlObj = new URL(url)
        videoId = urlObj.searchParams.get("v")
        playlistId = urlObj.searchParams.get("list")

        // Handle youtu.be format
        if (urlObj.hostname.includes("youtu.be")) {
          videoId = urlObj.pathname.slice(1)
        }
      } catch (e) {
        console.error("Invalid URL:", e)
      }
    }

    return { videoId, playlistId }
  }

  initializePlayer(videoId, playlistId) {
    if (window.YT && window.YT.Player) {
      this.createPlayer(videoId, playlistId)
    } else {
      // Wait for YouTube API to load
      window.onYouTubeIframeAPIReady = () => {
        this.createPlayer(videoId, playlistId)
      }
    }
  }

  createPlayer(videoId, playlistId) {
    this.player = new window.YT.Player("player", {
      height: "315",
      width: "560",
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event) => this.onPlayerReady(event, playlistId),
        onStateChange: (event) => this.onPlayerStateChange(event),
        onError: (event) => this.onPlayerError(event),
      },
    })
  }

  onPlayerReady(event, playlistId) {
    console.log("[v0] Player ready")
    this.loadBtn.classList.remove("loading")

    if (playlistId) {
      this.player.loadPlaylist({
        list: playlistId,
        index: 0,
        suggestedQuality: "default",
      })
    }

    this.updateTrackInfo()
    this.updateStatus("Video đã sẵn sàng!", "success")
    this.startProgressUpdater()
  }

  onPlayerStateChange(event) {
    console.log("[v0] Player state changed:", event.data)

    switch (event.data) {
      case window.YT.PlayerState.PLAYING:
        this.isPlaying = true
        this.playBtn.classList.add("playing")
        this.updateStatus("Đang phát...", "playing")
        this.startWaveAnimation()
        break
      case window.YT.PlayerState.PAUSED:
        this.isPlaying = false
        this.playBtn.classList.remove("playing")
        this.updateStatus("Đã tạm dừng", "paused")
        this.stopWaveAnimation()
        break
      case window.YT.PlayerState.ENDED:
        this.isPlaying = false
        this.playBtn.classList.remove("playing")
        this.updateStatus("Đã kết thúc", "ended")
        this.stopWaveAnimation()
        break
      case window.YT.PlayerState.BUFFERING:
        this.updateStatus("Đang tải...", "loading")
        break
    }

    this.updateTrackInfo()
  }

  onPlayerError(event) {
    console.error("[v0] Player error:", event.data)
    this.loadBtn.classList.remove("loading")

    let errorMessage = "Có lỗi xảy ra khi tải video"
    switch (event.data) {
      case 2:
        errorMessage = "ID video không hợp lệ"
        break
      case 5:
        errorMessage = "Video không thể phát trên HTML5 player"
        break
      case 100:
        errorMessage = "Video không tồn tại hoặc đã bị xóa"
        break
      case 101:
      case 150:
        errorMessage = "Video không cho phép phát nhúng"
        break
    }

    this.updateStatus(errorMessage, "error")
  }

  togglePlay() {
    if (!this.player) {
      this.updateStatus("Chưa tải video nào!", "error")
      return
    }

    if (this.isPlaying) {
      this.player.pauseVideo()
    } else {
      this.player.playVideo()
    }
  }

  previousVideo() {
    if (this.player && this.player.previousVideo) {
      this.player.previousVideo()
      this.updateStatus("Chuyển bài trước", "info")
    }
  }

  nextVideo() {
    if (this.player && this.player.nextVideo) {
      this.player.nextVideo()
      this.updateStatus("Chuyển bài tiếp", "info")
    }
  }

  toggleAudioMode() {
    this.isAudioMode = !this.isAudioMode
    this.videoWrapper.classList.toggle("audio-mode", this.isAudioMode)

    const modeText = this.isAudioMode ? "Chế độ âm thanh" : "Chế độ video"
    this.updateStatus(modeText, "info")

    // Update button appearance
    this.audioModeBtn.style.background = this.isAudioMode ? "var(--accent-primary)" : "var(--bg-primary)"
    this.audioModeBtn.style.color = this.isAudioMode ? "white" : "var(--text-primary)"
  }

  toggleMute() {
    if (!this.player) return

    if (this.player.isMuted()) {
      this.player.unMute()
      this.volumeRange.value = this.volume
    } else {
      this.player.mute()
      this.volumeRange.value = 0
    }
  }

  setVolume(volume) {
    this.volume = volume
    if (this.player) {
      this.player.setVolume(volume)
    }
  }

  seekTo(event) {
    if (!this.player || !this.duration) return

    const rect = this.progressBar.getBoundingClientRect()
    const percent = (event.clientX - rect.left) / rect.width
    const seekTime = percent * this.duration

    this.player.seekTo(seekTime, true)
  }

  updateTrackInfo() {
    if (!this.player) return

    try {
      const videoData = this.player.getVideoData()
      if (videoData) {
        this.trackTitle.textContent = videoData.title || "Không có tiêu đề"
        this.trackArtist.textContent = videoData.author || "Không rõ tác giả"
      }
    } catch (e) {
      console.error("[v0] Error getting video data:", e)
    }
  }

  startProgressUpdater() {
    setInterval(() => {
      if (this.player && this.isPlaying && !this.isDragging) {
        try {
          this.currentTime = this.player.getCurrentTime()
          this.duration = this.player.getDuration()

          if (this.duration > 0) {
            const percent = (this.currentTime / this.duration) * 100
            this.progressFill.style.width = `${percent}%`
            this.progressThumb.style.left = `${percent}%`
          }

          this.currentTimeEl.textContent = this.formatTime(this.currentTime)
          this.durationEl.textContent = this.formatTime(this.duration)
        } catch (e) {
          console.error("[v0] Error updating progress:", e)
        }
      }
    }, 1000)
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00"

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  startWaveAnimation() {
    const waveBars = document.querySelectorAll(".wave-bar")
    waveBars.forEach((bar) => {
      bar.style.animationPlayState = "running"
    })
  }

  stopWaveAnimation() {
    const waveBars = document.querySelectorAll(".wave-bar")
    waveBars.forEach((bar) => {
      bar.style.animationPlayState = "paused"
    })
  }

  updateStatus(message, type = "info") {
    const statusText = this.statusDisplay.querySelector(".status-text")
    statusText.textContent = message

    // Remove existing type classes
    this.statusDisplay.classList.remove("error", "success", "loading", "playing", "paused", "ended")

    // Add new type class
    if (type !== "info") {
      this.statusDisplay.classList.add(type)
    }

    console.log(`[v0] Status: ${message} (${type})`)
  }

  handleKeyboard(event) {
    if (event.target.tagName === "INPUT") return

    switch (event.code) {
      case "Space":
        event.preventDefault()
        this.togglePlay()
        break
      case "ArrowLeft":
        event.preventDefault()
        this.previousVideo()
        break
      case "ArrowRight":
        event.preventDefault()
        this.nextVideo()
        break
      case "KeyM":
        event.preventDefault()
        this.toggleMute()
        break
      case "KeyA":
        event.preventDefault()
        this.toggleAudioMode()
        break
    }
  }
}

// Initialize player when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Initializing YouTube Audio Player")
  new YouTubeAudioPlayer()
})

// Load YouTube API
if (!window.YT) {
  const tag = document.createElement("script")
  tag.src = "https://www.youtube.com/iframe_api"
  const firstScriptTag = document.getElementsByTagName("script")[0]
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
}
