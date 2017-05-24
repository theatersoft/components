let ar = 4 / 3

function resize () {
    const
        html = document.documentElement,
        w = html.clientWidth,
        h = html.clientHeight,
        landscape = w / h > ar,
        width = landscape ? Math.floor(h * ar) : w,
        height = landscape ? h : Math.floor(w / ar)
    if (w) {
        html.style.fontSize = height / 100 + 'px'
        html.style.display = "none"
        //            html.clientWidth; // Force relayout - important to new Android devices
        html.style.display = ""
    }
    document.body.style.cssText = `margin-top: ${-height / 2}px; margin-left: ${-width / 2}px; width: ${width}px; height: ${height}px;`
}

window.addEventListener('resize', resize)
resize()

export function setAr (value) {
    if (ar !== value) {
        ar = value
        resize()
    }
}

// request fullscreen if first mousedown is outside body
const fullscreen = e => {
    if (e.target === document.documentElement) document.body.webkitRequestFullscreen()
    document.documentElement.removeEventListener('mousedown', fullscreen)
}
document.documentElement.addEventListener('mousedown', fullscreen)