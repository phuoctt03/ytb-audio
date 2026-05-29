class YTBPlayer {
  constructor() {
    this.player = null
    this.playerReady = false   // true only after onReady fires
    this.pendingLoad = null    // { videoId, autoplay } — queued if player not ready yet
    this.isPlaying = false
    this.isAudioMode = false
    this.currentTime = 0
    this.duration = 0
    this.isDragging = false
    this.repeatMode = 'none' // none | one | all
    this.isShuffle = false
    this.playbackSpeed = 1
    this.autoNext = true
    this.volume = 100
    this.currentVideoId = null
    this.pendingVideoId = null
    this.wakeLock = null
    this.sleepEnd = null
    this.sleepInterval = null
    this.progressInterval = null
    this.pipWindow = null    // Document PiP window

    // Data
    this.queue = []
    this.currentQueueIndex = -1
    this.playlists = {}    // id -> { id, name, videos: [] }
    this.bookmarks = {}    // videoId -> [{ time, label }]

    this._loadStorage()
    this._initEl()
    this._bindEvents()
    this._initTheme()
    this._renderAll()
  }

  // ─── STORAGE ───────────────────────────────────────────────
  _loadStorage() {
    try {
      this.playlists  = JSON.parse(localStorage.getItem('ytb_pl')  || '{}')
      this.queue      = JSON.parse(localStorage.getItem('ytb_q')   || '[]')
      this.bookmarks  = JSON.parse(localStorage.getItem('ytb_bm')  || '{}')
      const s         = JSON.parse(localStorage.getItem('ytb_cfg') || '{}')
      this.repeatMode       = s.repeat    || 'none'
      this.isShuffle        = s.shuffle   || false
      this.volume           = s.volume    ?? 100
      this.playbackSpeed    = s.speed     || 1
      this.autoNext         = s.autoNext  !== false
    } catch(e) {}
  }

  _save() {
    localStorage.setItem('ytb_pl',  JSON.stringify(this.playlists))
    localStorage.setItem('ytb_q',   JSON.stringify(this.queue))
    localStorage.setItem('ytb_bm',  JSON.stringify(this.bookmarks))
    localStorage.setItem('ytb_cfg', JSON.stringify({
      repeat: this.repeatMode, shuffle: this.isShuffle,
      volume: this.volume, speed: this.playbackSpeed, autoNext: this.autoNext
    }))
  }

  // ─── ELEMENTS ──────────────────────────────────────────────
  _initEl() {
    const $ = id => document.getElementById(id)
    this.urlInput          = $('urlInput')
    this.loadBtn           = $('loadBtn')
    this.playBtn           = $('playBtn')
    this.prevBtn           = $('prevBtn')
    this.nextBtn           = $('nextBtn')
    this.shuffleBtn        = $('shuffleBtn')
    this.repeatBtn         = $('repeatBtn')
    this.audioModeBtn      = $('audioModeBtn')
    this.volumeBtn         = $('volumeBtn')
    this.volumeRange       = $('volumeRange')
    this.speedSelect       = $('speedSelect')
    this.progressBar       = $('progressBar')
    this.progressFill      = $('progressFill')
    this.progressThumb     = $('progressThumb')
    this.currentTimeEl     = $('currentTime')
    this.durationEl        = $('totalDuration')
    this.videoWrapper      = $('videoWrapper')
    this.audioOverlay      = $('audioOverlay')
    this.trackTitle        = $('trackTitle')
    this.trackArtist       = $('trackArtist')
    this.trackThumb        = $('trackThumb')
    this.thumbBg           = $('thumbBg')
    this.statusDot         = $('statusDot')
    this.statusText        = $('statusText')
    this.themeToggleBtn    = $('themeToggleBtn')
    this.sidebarToggleBtn  = $('sidebarToggleBtn')
    this.sidebar           = $('sidebar')
    this.closeSidebarBtn   = $('closeSidebarBtn')
    this.wakeLockBtn       = $('wakeLockBtn')
    this.blackScreenBtn    = $('blackScreenBtn')
    this.blackScreenOverlay= $('blackScreenOverlay')
    this.bsTitle           = $('bsTitle')
    this.toastContainer    = $('toastContainer')
    // Modals
    this.playlistModal     = $('playlistModal')
    this.closeModalBtn     = $('closeModal')
    this.playlistPickerList= $('playlistPickerList')
    this.newPlaylistNameInput = $('newPlaylistNameInput')
    this.createAndAddBtn   = $('createAndAddBtn')
    this.addToQueueOnlyBtn = $('addToQueueOnlyBtn')
    this.playNowBtn        = $('playNowBtn')
    this.createPlaylistModal  = $('createPlaylistModal')
    this.closeCreateModalBtn  = $('closeCreateModal')
    this.createPlaylistInput  = $('createPlaylistInput')
    this.confirmCreatePlaylistBtn = $('confirmCreatePlaylistBtn')
    this.openCreatePlaylistBtn    = $('openCreatePlaylistBtn')
    // Sidebar lists
    this.queueList         = $('queueList')
    this.queueCount        = $('queueCount')
    this.playlistsContainer= $('playlistsContainer')
    this.playlistCount     = $('playlistCount')
    this.bookmarkList      = $('bookmarkList')
    this.bookmarkCount     = $('bookmarkCount')
    this.clearQueueBtn     = $('clearQueueBtn')
    this.addBookmarkBtn    = $('addBookmarkBtn')
    // Sleep
    this.sleepTimerBtn        = $('sleepTimerBtn')
    this.sleepOptions         = $('sleepOptions')
    this.sleepCountdownWrap   = $('sleepCountdownWrap')
    this.sleepCountdownText   = $('sleepCountdownText')
    this.cancelSleepBtn       = $('cancelSleepBtn')
    this.customMinInput       = $('customMinInput')
    this.setCustomSleepBtn    = $('setCustomSleepBtn')
    this.autoNextToggle       = $('autoNextToggle')
    this.visualizer           = $('visualizer')
    this.pipBtn               = $('pipBtn')

    // Set initial state
    this.volumeRange.value = this.volume
    this.speedSelect.value = this.playbackSpeed
    this.autoNextToggle.checked = this.autoNext
    this._updateRepeatBtn()
    this._updateShuffleBtn()
  }

  // ─── EVENTS ────────────────────────────────────────────────
  _bindEvents() {
    // Load
    this.loadBtn.addEventListener('click', () => this._handleLoad())
    this.urlInput.addEventListener('keydown', e => { if(e.key==='Enter') this._handleLoad() })

    // Controls
    this.playBtn.addEventListener('click', () => this.togglePlay())
    this.prevBtn.addEventListener('click', () => this.playPrev())
    this.nextBtn.addEventListener('click', () => this.playNext())
    this.shuffleBtn.addEventListener('click', () => this._toggleShuffle())
    this.repeatBtn.addEventListener('click', () => this._cycleRepeat())
    this.audioModeBtn.addEventListener('click', () => this.toggleAudioMode())

    // Volume
    this.volumeBtn.addEventListener('click', () => this.toggleMute())
    this.volumeRange.addEventListener('input', e => this.setVolume(+e.target.value))

    // Speed
    this.speedSelect.addEventListener('change', e => this._setSpeed(+e.target.value))

    // Progress
    this.progressBar.addEventListener('click', e => this._seekTo(e))
    this.progressBar.addEventListener('mousedown', () => { this.isDragging = true })
    document.addEventListener('mouseup', () => { this.isDragging = false })
    this.progressBar.addEventListener('mousemove', e => { if(this.isDragging) this._seekTo(e) })

    // Touch progress
    this.progressBar.addEventListener('touchstart', e => { this.isDragging = true; this._seekTo(e.touches[0]) })
    this.progressBar.addEventListener('touchmove', e => { if(this.isDragging) this._seekTo(e.touches[0]); e.preventDefault() }, {passive:false})
    document.addEventListener('touchend', () => { this.isDragging = false })

    // Theme
    this.themeToggleBtn.addEventListener('click', () => this._toggleTheme())

    // Sidebar
    this.sidebarToggleBtn.addEventListener('click', () => this.sidebar.classList.toggle('open'))
    this.closeSidebarBtn.addEventListener('click', () => this.sidebar.classList.remove('open'))
    document.querySelectorAll('.stab').forEach(btn =>
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab)))
    this.clearQueueBtn.addEventListener('click', () => this._clearQueue())
    this.addBookmarkBtn.addEventListener('click', () => this._addBookmark())

    // Wake Lock
    this.wakeLockBtn.addEventListener('click', () => this._toggleWakeLock())

    // Black Screen
    this.blackScreenBtn.addEventListener('click', () => this._showBlackScreen())
    this.blackScreenOverlay.addEventListener('click', () => this._hideBlackScreen())
    document.addEventListener('keydown', e => {
      if(this.blackScreenOverlay.classList.contains('active')) {
        this._hideBlackScreen()
        return
      }
      this._handleKey(e)
    })

    // Playlist modal
    this.closeModalBtn.addEventListener('click', () => this._closePlaylistModal())
    this.playlistModal.addEventListener('click', e => { if(e.target===this.playlistModal) this._closePlaylistModal() })
    this.createAndAddBtn.addEventListener('click', () => this._createAndAddFromModal())
    this.addToQueueOnlyBtn.addEventListener('click', () => this._pendingToQueue())
    this.playNowBtn.addEventListener('click', () => this._pendingPlayNow())

    // Create playlist modal
    this.openCreatePlaylistBtn.addEventListener('click', () => this._openCreateModal())
    this.closeCreateModalBtn.addEventListener('click', () => this._closeCreateModal())
    this.createPlaylistModal.addEventListener('click', e => { if(e.target===this.createPlaylistModal) this._closeCreateModal() })
    this.confirmCreatePlaylistBtn.addEventListener('click', () => this._createPlaylistFromSidebar())
    this.createPlaylistInput.addEventListener('keydown', e => { if(e.key==='Enter') this._createPlaylistFromSidebar() })

    // Sleep
    this.sleepTimerBtn.addEventListener('click', () => this._toggleSleepOptions())
    document.querySelectorAll('.sleep-opt').forEach(b =>
      b.addEventListener('click', () => this._setSleepTimer(+b.dataset.min)))
    this.setCustomSleepBtn.addEventListener('click', () => {
      const m = +this.customMinInput.value; if(m>0) this._setSleepTimer(m)
    })
    this.cancelSleepBtn.addEventListener('click', () => this._cancelSleep())

    // Auto next
    this.autoNextToggle.addEventListener('change', e => { this.autoNext = e.target.checked; this._save() })

    // Picture in Picture
    this.pipBtn.addEventListener('click', () => this._togglePiP())
  }

  // ─── THEME ─────────────────────────────────────────────────
  _initTheme() {
    const t = localStorage.getItem('ytb_theme') || 'dark'
    document.documentElement.setAttribute('data-theme', t)
    this.themeToggleBtn.textContent = t==='dark' ? '☀️' : '🌙'
  }

  _toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme')
    const next = cur==='dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('ytb_theme', next)
    this.themeToggleBtn.textContent = next==='dark' ? '☀️' : '🌙'
  }

  // ─── LOAD & PARSE ──────────────────────────────────────────
  _handleLoad() {
    const raw = this.urlInput.value.trim()
    if(!raw) { this.toast('Nhập link YouTube!', 'error'); return }
    const { vid, pid } = this._parseUrl(raw)
    if(!vid && !pid) { this.toast('Link không hợp lệ!', 'error'); return }

    if(pid && !vid) {
      // Pure playlist URL — load directly
      this._loadPlaylist(pid)
      return
    }

    if(vid) {
      this.pendingVideoId = vid
      this._openPlaylistModal(vid)
    }
  }

  _parseUrl(raw) {
    let vid = null, pid = null
    if(/^[a-zA-Z0-9_-]{11}$/.test(raw)) { vid = raw; return { vid, pid } }
    try {
      const u = new URL(raw)
      vid = u.searchParams.get('v')
      pid = u.searchParams.get('list')
      if(u.hostname.includes('youtu.be')) vid = u.pathname.slice(1).split('?')[0]
    } catch(e) {}
    return { vid, pid }
  }

  // ─── PLAYER ────────────────────────────────────────────────
  _resetPlayerEl() {
    const wrapper = document.getElementById('videoWrapper')
    const old = document.getElementById('player')
    if (old) old.remove()
    const div = document.createElement('div')
    div.id = 'player'
    wrapper.insertBefore(div, wrapper.querySelector('.audio-overlay'))
  }

  _loadVideo(videoId, autoplay=true) {
    // Nếu đang phát đúng video này rồi → không reload, chỉ đảm bảo đang play
    if (videoId === this.currentVideoId && this.player && this.playerReady) {
      if (autoplay && !this.isPlaying) this.player.playVideo()
      this.loadBtn.classList.remove('loading')
      return
    }

    this.loadBtn.classList.add('loading')
    this._setStatus('Đang tải...', 'loading')
    this.currentVideoId = videoId
    this.urlInput.value = `https://youtube.com/watch?v=${videoId}`

    if (this.player && this.playerReady) {
      if (autoplay) this.player.loadVideoById(videoId)
      else this.player.cueVideoById(videoId)
    } else if (this.player && !this.playerReady) {
      this.pendingLoad = { videoId, autoplay }
    } else {
      this._initPlayer(videoId, null, autoplay)
    }
  }

  _loadPlaylist(pid) {
    this.loadBtn.classList.add('loading')
    this._setStatus('Đang tải playlist...', 'loading')
    if (this.player && this.playerReady) this.player.loadPlaylist({ list: pid, index: 0 })
    else this._initPlayer(null, pid, true)
  }

  _initPlayer(vid, pid, autoplay) {
    if (window.YT && window.YT.Player) this._create(vid, pid, autoplay)
    else window.onYouTubeIframeAPIReady = () => this._create(vid, pid, autoplay)
  }

  _create(vid, pid, autoplay) {
    this._resetPlayerEl()   // Tạo lại div#player sạch, tránh conflict với iframe cũ
    this.playerReady = false
    this.player = null

    const cfg = {
      height: '315', width: '560',
      playerVars: {
        autoplay: 0,          // Luôn 0 — gọi playVideo() thủ công sau trong _onReady
        controls: 1,
        rel: 1,
        modestbranding: 1,
        iv_load_policy: 3,
        playsinline: 1,
      },
      events: {
        onReady:       ev => this._onReady(ev, vid, pid, autoplay),
        onStateChange: ev => this._onState(ev),
        onError:       ev => this._onError(ev),
      }
    }
    if (vid) cfg.videoId = vid   // Chỉ truyền videoId khi có — tránh player lỗi với string rỗng
    this.player = new window.YT.Player('player', cfg)
  }

  _onReady(ev, vid, pid, autoplay) {
    this.playerReady = true
    this.loadBtn.classList.remove('loading')
    this.player.setVolume(this.volume)
    this.player.setPlaybackRate(this.playbackSpeed)

    if (pid) {
      this.player.loadPlaylist({ list: pid, index: 0 })
    } else if (vid && autoplay) {
      this.player.playVideo()
    }

    if (this.pendingLoad) {
      const { videoId, autoplay: pa } = this.pendingLoad
      this.pendingLoad = null
      if (pa) this.player.loadVideoById(videoId)
      else this.player.cueVideoById(videoId)
      this.currentVideoId = videoId
    }

    this._setStatus('Sẵn sàng!', 'success')
    this._startProgress()
    this._updateTrackInfo()
  }


  _onState(ev) {
    const S = window.YT.PlayerState
    if(ev.data === S.PLAYING) {
      this.isPlaying = true
      this.playBtn.classList.add('playing')
      this._setStatus('Đang phát...', 'playing')
      this._startWave()
      this._updateTrackInfo()
      this._updatePipWindow()
      // Capture new videoId after auto-next
      try {
        const newId = this.player.getVideoData()?.video_id
        if(newId && newId !== this.currentVideoId) this.currentVideoId = newId
      } catch(e) {}
    } else if(ev.data === S.PAUSED) {
      this.isPlaying = false
      this.playBtn.classList.remove('playing')
      this._setStatus('Tạm dừng', 'paused')
      this._stopWave()
      this._updatePipWindow()
    } else if(ev.data === S.ENDED) {
      this.isPlaying = false
      this.playBtn.classList.remove('playing')
      this._stopWave()
      this._onEnded()
    } else if(ev.data === S.BUFFERING) {
      this._setStatus('Đang tải...', 'loading')
    }
  }

  _onError(ev) {
    this.loadBtn.classList.remove('loading')

    const ERROR_MAP = {
      2:   { msg: 'ID video không hợp lệ',              hint: 'Kiểm tra lại link hoặc video ID' },
      5:   { msg: 'Video không thể phát trên HTML5',     hint: 'Video dùng định dạng không hỗ trợ' },
      100: { msg: 'Video không tồn tại hoặc đã bị xoá', hint: 'Video đã bị xoá hoặc private' },
      101: { msg: 'Video không cho phép nhúng',          hint: 'Chủ kênh đã tắt tính năng nhúng' },
      150: { msg: 'Video không cho phép nhúng',          hint: 'Chủ kênh đã tắt tính năng nhúng' },
      153: { msg: 'Lỗi cấu hình trình phát',            hint: 'Video có thể bị giới hạn nhúng hoặc yêu cầu Premium' },
    }

    const errInfo  = ERROR_MAP[ev.data] || { msg: `Lỗi không xác định (code: ${ev.data})`, hint: 'Thử video khác' }
    const videoId  = this.currentVideoId || 'unknown'
    const time     = new Date().toLocaleTimeString('vi-VN')

    // Console log chi tiết
    console.group(`🔴 [YTBPlayer] Lỗi phát video — ${time}`)
    console.error('Mã lỗi   :', ev.data)
    console.error('Mô tả    :', errInfo.msg)
    console.error('Gợi ý    :', errInfo.hint)
    console.error('Video ID :', videoId)
    console.error('URL      :', `https://www.youtube.com/watch?v=${videoId}`)
    console.groupEnd()

    // Lưu vào error log
    if (!this.errorLog) this.errorLog = []
    this.errorLog.unshift({ code: ev.data, msg: errInfo.msg, hint: errInfo.hint, videoId, time })
    if (this.errorLog.length > 20) this.errorLog.pop()

    // Hiện toast + status
    this.toast(`❌ [${ev.data}] ${errInfo.msg}`, 'error')
    this._setStatus(`Lỗi ${ev.data}: ${errInfo.msg}`, 'error')

    // Hiện error log panel
    this._renderErrorLog()
  }

  _renderErrorLog() {
    let panel = document.getElementById('errorLogPanel')
    if (!panel) {
      panel = document.createElement('div')
      panel.id = 'errorLogPanel'
      panel.className = 'error-log-panel'
      panel.innerHTML = `
        <div class="el-header">
          <span>🔴 Error Log</span>
          <button id="clearErrLogBtn" class="btn-icon-bare" title="Xoá log">🗑</button>
          <button id="closeErrLogBtn" class="btn-icon-bare" title="Đóng">✕</button>
        </div>
        <div class="el-body" id="elBody"></div>`
      document.querySelector('.main-content').appendChild(panel)
      document.getElementById('clearErrLogBtn').addEventListener('click', () => {
        this.errorLog = []; this._renderErrorLog()
      })
      document.getElementById('closeErrLogBtn').addEventListener('click', () => panel.remove())
    }

    const body = document.getElementById('elBody')
    if (!this.errorLog?.length) { body.innerHTML = '<div class="el-empty">Chưa có lỗi nào</div>'; return }
    body.innerHTML = this.errorLog.map(e => `
      <div class="el-row">
        <div class="el-meta">
          <span class="el-code">${e.code}</span>
          <span class="el-time">${e.time}</span>
        </div>
        <div class="el-msg">${e.msg}</div>
        <div class="el-hint">${e.hint}</div>
        <a class="el-link" href="https://youtube.com/watch?v=${e.videoId}" target="_blank">▶ Mở trên YouTube</a>
      </div>`).join('')
  }

  _onEnded() {
    // 1. Repeat one
    if(this.repeatMode === 'one') { this.player.seekTo(0); this.player.playVideo(); return }

    // 2. Next from queue
    if(this.queue.length > 0) {
      const nextIdx = this.isShuffle
        ? Math.floor(Math.random() * this.queue.length)
        : this.currentQueueIndex + 1

      if(nextIdx < this.queue.length) {
        this.currentQueueIndex = nextIdx
        this._loadVideo(this.queue[nextIdx].videoId)
        this._renderQueue()
        return
      } else if(this.repeatMode === 'all') {
        this.currentQueueIndex = 0
        this._loadVideo(this.queue[0].videoId)
        this._renderQueue()
        return
      }
    }

    // 3. Auto-next from YouTube (rel=1 already set — player handles suggestion)
    if(this.autoNext) {
      // YouTube player with rel=1 will autoplay related video on its own
      this._setStatus('Tự động phát tiếp...', 'loading')
    } else {
      this._setStatus('Đã kết thúc', 'ended')
    }
  }

  // ─── CONTROLS ──────────────────────────────────────────────
  togglePlay() {
    if (!this.player || !this.playerReady) { this.toast('Chưa tải video!', 'error'); return }
    this.isPlaying ? this.player.pauseVideo() : this.player.playVideo()
  }

  playPrev() {
    if(this.currentQueueIndex > 0) {
      this.currentQueueIndex--
      this._loadVideo(this.queue[this.currentQueueIndex].videoId)
      this._renderQueue()
    } else if(this.player?.previousVideo) { this.player.previousVideo() }
  }

  playNext() {
    if(this.queue.length > 0) this._onEnded()
    else if(this.player?.nextVideo) this.player.nextVideo()
  }

  toggleAudioMode() {
    this.isAudioMode = !this.isAudioMode
    this.videoWrapper.classList.toggle('audio-mode', this.isAudioMode)
    this.audioModeBtn.classList.toggle('active', this.isAudioMode)
    this.toast(this.isAudioMode ? '🎵 Audio Mode ON' : '🎬 Video Mode', 'info')
  }

  toggleMute() {
    if(!this.player) return
    if(this.player.isMuted()) {
      this.player.unMute(); this.volumeRange.value = this.volume; this.volumeBtn.textContent = '🔊'
    } else {
      this.player.mute(); this.volumeRange.value = 0; this.volumeBtn.textContent = '🔇'
    }
  }

  setVolume(v) {
    this.volume = v
    if(this.player) this.player.setVolume(v)
    this.volumeBtn.textContent = v===0 ? '🔇' : v<50 ? '🔉' : '🔊'
    this._save()
  }

  _setSpeed(s) {
    this.playbackSpeed = s
    if(this.player) this.player.setPlaybackRate(s)
    this._save()
    this.toast(`⚡ ${s}×`, 'info')
  }

  _seekTo(ev) {
    if(!this.player || !this.duration) return
    const rect = this.progressBar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
    this.player.seekTo(pct * this.duration, true)
  }

  _toggleShuffle() {
    this.isShuffle = !this.isShuffle
    this._updateShuffleBtn()
    this._save()
    this.toast(this.isShuffle ? '🔀 Shuffle ON' : 'Shuffle OFF', 'info')
  }

  _updateShuffleBtn() { this.shuffleBtn.classList.toggle('active', this.isShuffle) }

  _cycleRepeat() {
    const m = ['none','one','all']
    this.repeatMode = m[(m.indexOf(this.repeatMode)+1)%3]
    this._updateRepeatBtn()
    this._save()
    this.toast({ none:'Không lặp', one:'🔂 Lặp 1 bài', all:'🔁 Lặp tất cả' }[this.repeatMode], 'info')
  }

  _updateRepeatBtn() {
    this.repeatBtn.classList.remove('active','repeat-one')
    if(this.repeatMode==='one') this.repeatBtn.classList.add('active','repeat-one')
    else if(this.repeatMode==='all') this.repeatBtn.classList.add('active')
  }

  // ─── TRACK INFO ────────────────────────────────────────────
  _updateTrackInfo() {
    if(!this.player) return
    try {
      const d = this.player.getVideoData()
      if(!d) return
      const title  = d.title  || 'Không có tiêu đề'
      const author = d.author || 'Không rõ'
      this.trackTitle.textContent  = title
      this.trackArtist.textContent = author
      this.bsTitle.textContent     = title

      if(this.currentVideoId) {
        const thumb = `https://img.youtube.com/vi/${this.currentVideoId}/mqdefault.jpg`
        this.trackThumb.src  = thumb
        this.thumbBg.style.backgroundImage = `url(${thumb})`

        // Update queue titles
        this.queue.forEach(item => {
          if(item.videoId === this.currentVideoId && !item.title) {
            item.title = title; item.author = author
          }
        })
        // Update playlist titles
        Object.values(this.playlists).forEach(pl => {
          pl.videos.forEach(v => { if(v.videoId === this.currentVideoId && !v.title) { v.title = title; v.author = author } })
        })
        this._save()
        this._renderQueue()
        this._renderPlaylists()
        this._updatePipWindow()
      }
    } catch(e) {}
  }

  // ─── PROGRESS ──────────────────────────────────────────────
  _startProgress() {
    if(this.progressInterval) clearInterval(this.progressInterval)
    this.progressInterval = setInterval(() => {
      if(!this.player || this.isDragging) return
      try {
        const cur = this.player.getCurrentTime() || 0
        const dur = this.player.getDuration()    || 0
        this.currentTime = cur; this.duration = dur
        if(dur > 0) {
          const pct = (cur/dur)*100
          this.progressFill.style.width = pct+'%'
          this.progressThumb.style.left = pct+'%'
        }
        this.currentTimeEl.textContent = this._fmt(cur)
        this.durationEl.textContent    = this._fmt(dur)
      } catch(e) {}
    }, 500)
  }

  _fmt(s) {
    if(!s || isNaN(s)) return '0:00'
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
  }

  // ─── WAVE ──────────────────────────────────────────────────
  _startWave() { this.visualizer.querySelectorAll('.wbar').forEach(b => b.style.animationPlayState='running') }
  _stopWave()  { this.visualizer.querySelectorAll('.wbar').forEach(b => b.style.animationPlayState='paused')  }

  // ─── STATUS ────────────────────────────────────────────────
  _setStatus(msg, type='info') {
    this.statusText.textContent = msg
    this.statusDot.className = 'status-dot ' + type
  }

  // ─── SIDEBAR / TABS ────────────────────────────────────────
  _switchTab(tab) {
    document.querySelectorAll('.stab').forEach(b => b.classList.toggle('active', b.dataset.tab===tab))
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id===`tab-${tab}`))
  }

  _renderAll() { this._renderQueue(); this._renderPlaylists(); this._renderBookmarks() }

  // ─── QUEUE ─────────────────────────────────────────────────
  _addToQueue(info, silent=false) {
    this.queue.push(info)
    this._save(); this._renderQueue()
    if(!silent) this.toast(`Đã thêm vào queue: ${info.title||info.videoId}`, 'success')
  }

  _clearQueue() { this.queue=[]; this.currentQueueIndex=-1; this._save(); this._renderQueue(); this.toast('Đã xóa queue','info') }

  _renderQueue() {
    this.queueCount.textContent = `${this.queue.length} bài`
    if(!this.queue.length) { this.queueList.innerHTML='<div class="empty-state"><span>🎵</span><p>Queue trống</p></div>'; return }
    this.queueList.innerHTML = this.queue.map((it,i) => `
      <div class="list-item ${i===this.currentQueueIndex?'active':''}" data-qi="${i}">
        <img class="li-thumb" src="https://img.youtube.com/vi/${it.videoId}/default.jpg" onerror="this.style.visibility='hidden'">
        <div class="li-info">
          <div class="li-title">${it.title||it.videoId}</div>
          <div class="li-sub">${it.author||''}</div>
        </div>
        <div class="li-right">
          ${i===this.currentQueueIndex ? '<span class="now-badge">▶</span>' : ''}
          <button class="rm-btn" data-qi="${i}">✕</button>
        </div>
      </div>`).join('')

    this.queueList.querySelectorAll('.list-item').forEach(el =>
      el.addEventListener('click', e => {
        if(e.target.closest('.rm-btn')) return
        const i = +el.dataset.qi
        this.currentQueueIndex = i - 1
        this._onEnded()
      }))
    this.queueList.querySelectorAll('.rm-btn').forEach(b =>
      b.addEventListener('click', e => {
        e.stopPropagation()
        const i = +b.dataset.qi
        this.queue.splice(i,1)
        if(this.currentQueueIndex >= i) this.currentQueueIndex--
        this._save(); this._renderQueue()
      }))
  }

  // ─── PLAYLISTS ─────────────────────────────────────────────
  _openPlaylistModal(vid) {
    this._renderPickerList()
    this.playlistModal.classList.add('active')
  }

  _closePlaylistModal() {
    this.playlistModal.classList.remove('active')
    this.pendingVideoId = null
    this.newPlaylistNameInput.value = ''
  }

  _renderPickerList() {
    const pls = Object.values(this.playlists)
    if(!pls.length) { this.playlistPickerList.innerHTML='<p class="picker-empty">Chưa có playlist. Tạo bên dưới.</p>'; return }
    this.playlistPickerList.innerHTML = pls.map(p => `
      <button class="picker-btn" data-plid="${p.id}">📂 ${p.name} <span class="pick-cnt">${p.videos.length} bài</span></button>`).join('')
    this.playlistPickerList.querySelectorAll('.picker-btn').forEach(b =>
      b.addEventListener('click', () => this._addPendingToPlaylist(b.dataset.plid)))
  }

  _addPendingToPlaylist(plid) {
    if(!this.pendingVideoId) return
    const vid = this.pendingVideoId
    const pl = this.playlists[plid]; if(!pl) return
    if(!pl.videos.find(v=>v.videoId===vid)) {
      pl.videos.push({ videoId:vid, title:'', author:'', addedAt:Date.now() })
      this._save(); this._renderPlaylists()
      this.toast(`Đã thêm vào "${pl.name}"`, 'success')
    } else {
      this.toast(`Video đã có trong "${pl.name}"`, 'warning')
    }
    this._addToQueue({ videoId:vid, title:'', author:'' }, true)
    this._loadVideo(vid)
    this._closePlaylistModal()
  }

  _pendingToQueue() {
    if(!this.pendingVideoId) return
    this._addToQueue({ videoId:this.pendingVideoId, title:'', author:'' })
    this._closePlaylistModal()
  }

  _pendingPlayNow() {
    if(!this.pendingVideoId) return
    this._loadVideo(this.pendingVideoId)
    this._addToQueue({ videoId:this.pendingVideoId, title:'', author:'' }, true)
    this._closePlaylistModal()
  }

  _createAndAddFromModal() {
    const name = this.newPlaylistNameInput.value.trim()
    if(!name) { this.toast('Nhập tên playlist!','error'); return }
    const pl = this._createPlaylist(name)
    this.newPlaylistNameInput.value = ''
    if(this.pendingVideoId) this._addPendingToPlaylist(pl.id)
  }

  _openCreateModal() { this.createPlaylistModal.classList.add('active'); this.createPlaylistInput.focus() }
  _closeCreateModal() { this.createPlaylistModal.classList.remove('active'); this.createPlaylistInput.value='' }

  _createPlaylistFromSidebar() {
    const name = this.createPlaylistInput.value.trim(); if(!name) return
    this._createPlaylist(name); this._closeCreateModal()
  }

  _createPlaylist(name) {
    const id = 'pl_' + Date.now()
    const pl = { id, name, created:Date.now(), videos:[] }
    this.playlists[id] = pl; this._save(); this._renderPlaylists()
    this.toast(`Tạo playlist "${name}"`, 'success')
    return pl
  }

  _deletePlaylist(id) {
    if(!confirm(`Xóa playlist "${this.playlists[id]?.name}"?`)) return
    delete this.playlists[id]; this._save(); this._renderPlaylists()
    this.toast('Đã xóa playlist','info')
  }

  _playPlaylist(id) {
    const pl = this.playlists[id]
    if(!pl?.videos.length) { this.toast('Playlist trống!','warning'); return }
    this.queue = [...pl.videos]; this.currentQueueIndex = -1
    this._save(); this._renderQueue()
    this._onEnded()
    this._switchTab('queue')
    this.toast(`▶ Đang phát "${pl.name}"`, 'success')
  }

  _removeFromPlaylist(plid, idx) {
    this.playlists[plid]?.videos.splice(idx,1)
    this._save(); this._renderPlaylists()
  }

  _renderPlaylists() {
    const pls = Object.values(this.playlists)
    this.playlistCount.textContent = `${pls.length} playlist`
    if(!pls.length) { this.playlistsContainer.innerHTML='<div class="empty-state"><span>📂</span><p>Chưa có playlist</p></div>'; return }
    this.playlistsContainer.innerHTML = pls.map(p => `
      <div class="pl-card">
        <div class="pl-card-header">
          <div class="pl-card-meta">
            <span class="pl-icon">📂</span>
            <div><div class="pl-name">${p.name}</div><div class="pl-cnt">${p.videos.length} bài</div></div>
          </div>
          <div class="pl-card-actions">
            <button class="pl-play-btn" data-plid="${p.id}">▶</button>
            <button class="pl-del-btn"  data-plid="${p.id}">🗑</button>
          </div>
        </div>
        <div class="pl-videos">
          ${p.videos.slice(0,4).map((v,i)=>`
            <div class="pv-item" data-plid="${p.id}" data-vi="${i}">
              <img class="pv-thumb" src="https://img.youtube.com/vi/${v.videoId}/default.jpg" onerror="this.style.visibility='hidden'">
              <span class="pv-title">${v.title||v.videoId}</span>
              <button class="rm-btn pv-rm" data-plid="${p.id}" data-vi="${i}">✕</button>
            </div>`).join('')}
          ${p.videos.length>4?`<div class="pl-more">+${p.videos.length-4} bài nữa</div>`:''}
        </div>
      </div>`).join('')

    this.playlistsContainer.querySelectorAll('.pl-play-btn').forEach(b=>b.addEventListener('click', ()=>this._playPlaylist(b.dataset.plid)))
    this.playlistsContainer.querySelectorAll('.pl-del-btn').forEach(b=>b.addEventListener('click', ()=>this._deletePlaylist(b.dataset.plid)))
    this.playlistsContainer.querySelectorAll('.pv-item').forEach(el=>el.addEventListener('click', e=>{
      if(e.target.closest('.pv-rm')) return
      const v = this.playlists[el.dataset.plid]?.videos[+el.dataset.vi]
      if(v) this._loadVideo(v.videoId)
    }))
    this.playlistsContainer.querySelectorAll('.pv-rm').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation(); this._removeFromPlaylist(b.dataset.plid, +b.dataset.vi)
    }))
  }

  // ─── BOOKMARKS ─────────────────────────────────────────────
  _addBookmark() {
    if(!this.player || !this.currentVideoId) { this.toast('Chưa có video!','error'); return }
    const time  = Math.floor(this.player.getCurrentTime())
    const label = prompt(`Nhãn bookmark (${this._fmt(time)}):`, this._fmt(time)) ?? this._fmt(time)
    if(!label && label !== '') return
    if(!this.bookmarks[this.currentVideoId]) this.bookmarks[this.currentVideoId] = []
    this.bookmarks[this.currentVideoId].push({ time, label: label||this._fmt(time), videoTitle: this.trackTitle.textContent })
    this._save(); this._renderBookmarks()
    this.toast(`🔖 "${label||this._fmt(time)}" đã lưu`, 'success')
  }

  _renderBookmarks() {
    const all = Object.entries(this.bookmarks).flatMap(([vid, bms]) => bms.map((b,i)=>({...b, vid, i})))
    this.bookmarkCount.textContent = `${all.length} bookmark`
    if(!all.length) { this.bookmarkList.innerHTML='<div class="empty-state"><span>🔖</span><p>Chưa có bookmark</p></div>'; return }

    const cur = this.currentVideoId ? (this.bookmarks[this.currentVideoId]||[]).map((b,i)=>({...b, vid:this.currentVideoId, i})) : []
    const oth = all.filter(b => b.vid !== this.currentVideoId)

    const mkBm = b => `
      <div class="bm-item" data-vid="${b.vid}" data-time="${b.time}" data-i="${b.i}">
        <div class="bm-time">${this._fmt(b.time)}</div>
        <div class="bm-meta">
          <div class="bm-label">${b.label}</div>
          ${b.videoTitle?`<div class="bm-vt">${b.videoTitle}</div>`:''}
        </div>
        <button class="rm-btn bm-rm" data-vid="${b.vid}" data-i="${b.i}">✕</button>
      </div>`

    this.bookmarkList.innerHTML = [
      cur.length?'<div class="section-label">Video hiện tại</div>':'',
      ...cur.map(mkBm),
      oth.length?'<div class="section-label">Khác</div>':'',
      ...oth.map(mkBm)
    ].join('')

    this.bookmarkList.querySelectorAll('.bm-item').forEach(el=>el.addEventListener('click', e=>{
      if(e.target.closest('.bm-rm')) return
      const vid=el.dataset.vid, time=+el.dataset.time
      if(vid !== this.currentVideoId) { this._loadVideo(vid); setTimeout(()=>this.player?.seekTo(time,true),2000) }
      else this.player?.seekTo(time,true)
    }))
    this.bookmarkList.querySelectorAll('.bm-rm').forEach(b=>b.addEventListener('click', e=>{
      e.stopPropagation()
      const vid=b.dataset.vid, i=+b.dataset.i
      this.bookmarks[vid]?.splice(i,1)
      if(!this.bookmarks[vid]?.length) delete this.bookmarks[vid]
      this._save(); this._renderBookmarks()
    }))
  }

  // ─── WAKE LOCK ─────────────────────────────────────────────
  async _toggleWakeLock() { this.wakeLock ? this._releaseWakeLock() : await this._requestWakeLock() }

  async _requestWakeLock() {
    if(!('wakeLock' in navigator)) { this.toast('Trình duyệt chưa hỗ trợ. Dùng Chrome/Edge.','warning'); return }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen')
      this.wakeLockBtn.classList.add('active')
      this.wakeLockBtn.title = 'Wake Lock: BẬT — Click để tắt'
      this.toast('👁 Màn hình sẽ không tắt tự động','success')
      this.wakeLock.addEventListener('release', () => { this.wakeLock=null; this.wakeLockBtn.classList.remove('active') })
    } catch(e) { this.toast('Không thể bật Wake Lock: '+e.message,'error') }
  }

  _releaseWakeLock() {
    this.wakeLock?.release(); this.wakeLock=null
    this.wakeLockBtn.classList.remove('active')
    this.toast('Wake Lock đã tắt','info')
  }

  // ─── SLEEP TIMER ───────────────────────────────────────────
  _toggleSleepOptions() {
    if(this.sleepEnd) { this._cancelSleep(); return }
    this.sleepOptions.classList.toggle('hidden')
  }

  _setSleepTimer(mins) {
    this._cancelSleep()
    this.sleepOptions.classList.add('hidden')
    this.sleepEnd = Date.now() + mins * 60000
    this.sleepCountdownWrap.classList.remove('hidden')
    this.sleepTimerBtn.classList.add('active')
    this.sleepInterval = setInterval(() => {
      const rem = this.sleepEnd - Date.now()
      if(rem <= 0) { this._triggerSleep(); return }
      const m = Math.floor(rem/60000), s = Math.floor((rem%60000)/1000)
      this.sleepCountdownText.textContent = `${m}:${String(s).padStart(2,'0')}`
    }, 1000)
    this.toast(`⏰ Hẹn giờ: ${mins} phút`,'info')
  }

  _cancelSleep() {
    clearInterval(this.sleepInterval); this.sleepInterval=null; this.sleepEnd=null
    this.sleepCountdownWrap.classList.add('hidden')
    this.sleepTimerBtn.classList.remove('active')
    this.sleepOptions.classList.add('hidden')
  }

  _triggerSleep() {
    this._cancelSleep()
    this.player?.pauseVideo()
    this._showBlackScreen()
    this.toast('⏰ Hẹn giờ kết thúc — Nhạc đã dừng','info')
  }

  // ─── BLACK SCREEN ──────────────────────────────────────────
  _showBlackScreen() { this.blackScreenOverlay.classList.add('active'); this._updateTrackInfo() }
  _hideBlackScreen() { this.blackScreenOverlay.classList.remove('active') }

  // ─── PICTURE IN PICTURE ────────────────────────────────────
  async _togglePiP() {
    // Đang mở PiP → đóng lại
    if (this.pipWindow && !this.pipWindow.closed) {
      this.pipWindow.close()
      return
    }

    if (!this.player || !this.playerReady) {
      this.toast('⚠️ Chưa có video để bật PiP!', 'warning')
      return
    }

    // Document Picture-in-Picture API (Chrome 116+)
    if (window.documentPictureInPicture) {
      try {
        this.pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 320, height: 200,
          disallowReturnToOpener: false,
        })
        this._buildPipContent(this.pipWindow)
        this.pipBtn.classList.add('active')
        this.toast('⧉ Mini Player đang bật', 'success')

        this.pipWindow.addEventListener('pagehide', () => {
          this.pipWindow = null
          this.pipBtn.classList.remove('active')
        })
        return
      } catch(e) {
        console.warn('[YTBPlayer] Document PiP error:', e)
      }
    }

    // Fallback: hướng dẫn chuột phải
    this._showPiPFallback()
  }

  _buildPipContent(win) {
    const doc = win.document
    const thumb = this.currentVideoId
      ? `https://img.youtube.com/vi/${this.currentVideoId}/mqdefault.jpg`
      : ''
    const title  = this.trackTitle?.textContent  || 'Đang phát nhạc...'
    const artist = this.trackArtist?.textContent || ''
    const isPlay = this.isPlaying

    doc.head.innerHTML = `
      <meta charset="UTF-8">
      <style>
        * { margin:0; padding:0; box-sizing:border-box }
        body {
          font-family: 'DM Sans', system-ui, sans-serif;
          background: #0d0d14; color: #f1f5f9;
          height: 100vh; display: flex; flex-direction: column;
          overflow: hidden; user-select: none;
        }
        .pip-thumb {
          width: 100%; height: 120px; object-fit: cover;
          display: block; flex-shrink: 0;
        }
        .pip-body {
          flex: 1; display: flex; flex-direction: column;
          justify-content: space-between; padding: 8px 10px 6px;
          background: linear-gradient(180deg, #13131f 0%, #0d0d14 100%);
        }
        .pip-meta { overflow: hidden }
        .pip-title {
          font-size: 0.78rem; font-weight: 600; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
          color: #f1f5f9; margin-bottom: 1px;
        }
        .pip-artist {
          font-size: 0.68rem; color: #64748b; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .pip-controls {
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .pip-btn {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 50%; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #94a3b8; font-size: 0.75rem;
          transition: all 0.18s ease;
        }
        .pip-btn:hover { background: rgba(255,255,255,0.12); color: #f1f5f9 }
        .pip-btn.play {
          background: linear-gradient(135deg, #7c3aed, #a855f7);
          border-color: transparent; color: #fff; width: 38px; height: 38px;
          font-size: 0.9rem;
          box-shadow: 0 2px 12px rgba(124,58,237,0.5);
        }
        .pip-btn.play:hover { transform: scale(1.08) }
      </style>`

    doc.body.innerHTML = `
      <img class="pip-thumb" id="pipThumb" src="${thumb}" alt="">
      <div class="pip-body">
        <div class="pip-meta">
          <div class="pip-title" id="pipTitle">${title}</div>
          <div class="pip-artist" id="pipArtist">${artist}</div>
        </div>
        <div class="pip-controls">
          <button class="pip-btn" id="pipPrev" title="Bài trước">⏮</button>
          <button class="pip-btn play" id="pipPlay">${isPlay ? '⏸' : '▶'}</button>
          <button class="pip-btn" id="pipNext" title="Bài tiếp">⏭</button>
        </div>
      </div>`

    doc.getElementById('pipPlay').addEventListener('click', () => {
      this.togglePlay()
      doc.getElementById('pipPlay').textContent = this.isPlaying ? '⏸' : '▶'
    })
    doc.getElementById('pipPrev').addEventListener('click', () => this.playPrev())
    doc.getElementById('pipNext').addEventListener('click', () => this.playNext())
  }

  _updatePipWindow() {
    if (!this.pipWindow || this.pipWindow.closed) return
    const doc = this.pipWindow.document
    const thumb = this.currentVideoId
      ? `https://img.youtube.com/vi/${this.currentVideoId}/mqdefault.jpg`
      : ''
    const t = doc.getElementById('pipThumb');  if (t) t.src = thumb
    const tt = doc.getElementById('pipTitle'); if (tt) tt.textContent = this.trackTitle?.textContent || ''
    const ta = doc.getElementById('pipArtist'); if (ta) ta.textContent = this.trackArtist?.textContent || ''
    const pb = doc.getElementById('pipPlay'); if (pb) pb.textContent = this.isPlaying ? '⏸' : '▶'
  }

  _showPiPFallback() {
    let existing = document.getElementById('pipFallbackToast')
    if (existing) { existing.remove() }
    const el = document.createElement('div')
    el.id = 'pipFallbackToast'
    el.className = 'pip-fallback'
    el.innerHTML = `
      <div class="pip-fb-header">
        <span>⧉ Picture-in-Picture</span>
        <button class="pip-fb-close">✕</button>
      </div>
      <p>Trình duyệt chưa hỗ trợ Document PiP (cần Chrome 116+).<br>Bạn có thể:</p>
      <ul>
        <li>Chuột phải vào video → chọn <b>“Picture in picture”</b></li>
        <li>Hoặc cài <a href="https://chromewebstore.google.com/detail/picture-in-picture-extens/hkgfoiooedgoejojocmhlaklaeopbigc" target="_blank">PiP Extension của Google</a></li>
      </ul>
    `
    document.querySelector('.main-content').appendChild(el)
    el.querySelector('.pip-fb-close').addEventListener('click', () => el.remove())
    setTimeout(() => el?.remove(), 8000)
  }

  // ─── KEYBOARD ──────────────────────────────────────────────
  _handleKey(e) {
    if(e.target.tagName==='INPUT' || e.target.tagName==='SELECT' || e.target.tagName==='TEXTAREA') return
    switch(e.code) {
      case 'Space':     e.preventDefault(); this.togglePlay(); break
      case 'ArrowLeft':
        e.preventDefault()
        if(e.shiftKey) this.playPrev()
        else if(this.player) this.player.seekTo(Math.max(0,(this.currentTime||0)-10),true)
        break
      case 'ArrowRight':
        e.preventDefault()
        if(e.shiftKey) this.playNext()
        else if(this.player) this.player.seekTo((this.currentTime||0)+10,true)
        break
      case 'KeyM': e.preventDefault(); this.toggleMute(); break
      case 'KeyA': e.preventDefault(); this.toggleAudioMode(); break
      case 'KeyB': e.preventDefault(); this._addBookmark(); break
      case 'KeyF': e.preventDefault(); this._showBlackScreen(); break
      case 'KeyP': e.preventDefault(); this._togglePiP(); break
    }
  }

  // ─── TOAST ─────────────────────────────────────────────────
  toast(msg, type='info') {
    const el = document.createElement('div')
    el.className = `toast toast-${type}`
    el.textContent = msg
    this.toastContainer.appendChild(el)
    requestAnimationFrame(() => el.classList.add('show'))
    setTimeout(() => { el.classList.remove('show'); setTimeout(()=>el.remove(), 300) }, 3000)
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => { window._ytbPlayer = new YTBPlayer() })
