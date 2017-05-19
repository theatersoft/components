export function classes (...args) {
    const classes = []
    for (const arg of args)
        if (!arg) continue
        else if (typeof arg === 'string')
            classes.push(arg)
        else if (typeof arg === 'object')
            for (const [k, v] of Object.entries(arg))
                if (v) classes.push(k)
    return classes.join(' ')
}

export const mousePosition = event => ([
    event.pageX - (window.scrollX || window.pageXOffset),
    event.pageY - (window.scrollY || window.pageYOffset)
])

export const touchPosition = event => ([
    event.touches[0].pageX - (window.scrollX || window.pageXOffset),
    event.touches[0].pageY - (window.scrollY || window.pageYOffset)
])