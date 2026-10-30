use std::io::{self, Read, Write};

pub struct RawModeGuard {
    orig: libc::termios,
}

impl RawModeGuard {
    pub fn enter() -> Option<Self> {
        unsafe {
            let mut orig = std::mem::zeroed();
            if libc::tcgetattr(libc::STDIN_FILENO, &mut orig) != 0 {
                return None;
            }
            let mut raw = orig;
            raw.c_lflag &= !(libc::ICANON | libc::ECHO);
            raw.c_cc[libc::VMIN] = 0;
            raw.c_cc[libc::VTIME] = 0;
            if libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &raw) != 0 {
                return None;
            }
            print!("\x1b[?7l");
            let _ = io::stdout().flush();
            Some(Self { orig })
        }
    }
}

impl Drop for RawModeGuard {
    fn drop(&mut self) {
        unsafe {
            libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &self.orig);
        }
        print!("\x1b[?7h");
        let _ = io::stdout().flush();
    }
}

pub fn get_terminal_width() -> usize {
    unsafe {
        let mut winsize: libc::winsize = std::mem::zeroed();
        if libc::ioctl(libc::STDOUT_FILENO, libc::TIOCGWINSZ, &mut winsize) == 0
            && winsize.ws_col > 0
        {
            (winsize.ws_col as usize).max(60)
        } else {
            80
        }
    }
}

pub fn clear_screen() {
    print!("\x1b[2J\x1b[H\x1b[?25l");
    let _ = io::stdout().flush();
}

pub fn check_quit_key() -> bool {
    let mut buf = [0u8; 1];
    if let Ok(n) = io::stdin().read(&mut buf) {
        if n > 0 && (buf[0] == b'q' || buf[0] == b'Q' || buf[0] == 3) {
            return true;
        }
    }
    false
}
