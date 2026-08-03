import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useLongPress } from './useLongPress.js'

const at = (x, y) => ({ clientX: x, clientY: y })

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('release før terskelen gir tap, ikke hold', () => {
    const onTap = vi.fn(); const onHold = vi.fn()
    const lp = useLongPress({ holdMs: 600, onTap, onHold })
    lp.onPointerDown(at(0, 0))
    vi.advanceTimersByTime(300)
    lp.onPointerUp()
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onHold).not.toHaveBeenCalled()
  })

  it('holder man forbi terskelen gir hold, og release teller ikke som tap', () => {
    const onTap = vi.fn(); const onHold = vi.fn()
    const lp = useLongPress({ holdMs: 600, onTap, onHold })
    lp.onPointerDown(at(0, 0))
    vi.advanceTimersByTime(600)
    expect(onHold).toHaveBeenCalledTimes(1)
    lp.onPointerUp()
    expect(onTap).not.toHaveBeenCalled()
  })

  // Samsung Internet sender pointercancel i stedet for pointerup når knappen
  // krymper (active:scale-95). Da MÅ trykket committe, ellers mistes hakket.
  it('pointercancel er en release og committer tapet', () => {
    const onTap = vi.fn()
    const lp = useLongPress({ holdMs: 600, onTap })
    lp.onPointerDown(at(0, 0))
    vi.advanceTimersByTime(100)
    lp.onPointerCancel()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('pointerup + pointercancel etter hverandre teller bare én gang', () => {
    const onTap = vi.fn()
    const lp = useLongPress({ holdMs: 600, onTap })
    lp.onPointerDown(at(0, 0))
    lp.onPointerUp()
    lp.onPointerCancel()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('release etter utløst hold teller ikke som tap, uansett hvor mange events', () => {
    const onTap = vi.fn(); const onHold = vi.fn()
    const lp = useLongPress({ holdMs: 600, onTap, onHold })
    lp.onPointerDown(at(0, 0))
    vi.advanceTimersByTime(700)
    lp.onPointerUp()
    lp.onPointerCancel()
    expect(onHold).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('drag forbi toleransen avbryter både tap og hold', () => {
    const onTap = vi.fn(); const onHold = vi.fn()
    const lp = useLongPress({ holdMs: 600, moveTolerancePx: 10, onTap, onHold })
    lp.onPointerDown(at(0, 0))
    lp.onPointerMove(at(20, 0))
    vi.advanceTimersByTime(700)
    lp.onPointerUp()
    expect(onTap).not.toHaveBeenCalled()
    expect(onHold).not.toHaveBeenCalled()
  })

  it('drag innenfor toleransen beholder tapet', () => {
    const onTap = vi.fn()
    const lp = useLongPress({ holdMs: 600, moveTolerancePx: 10, onTap })
    lp.onPointerDown(at(0, 0))
    lp.onPointerMove(at(6, 6))   // hypot ≈ 8.5
    lp.onPointerUp()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('armed=false armerer ingen timer — alt skjer på release', () => {
    const onTap = vi.fn(); const onHold = vi.fn()
    const lp = useLongPress({ holdMs: 600, armed: () => false, onTap, onHold })
    lp.onPointerDown(at(0, 0))
    vi.advanceTimersByTime(2000)
    expect(onHold).not.toHaveBeenCalled()
    expect(lp.isHolding.value).toBe(false)
    lp.onPointerUp()
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('armed=false avbrytes fortsatt av drag', () => {
    const onTap = vi.fn()
    const lp = useLongPress({ armed: () => false, moveTolerancePx: 10, onTap })
    lp.onPointerDown(at(0, 0))
    lp.onPointerMove(at(40, 0))
    lp.onPointerUp()
    expect(onTap).not.toHaveBeenCalled()
  })

  it('isHolding er sann under holdet og faller tilbake etterpå', () => {
    const lp = useLongPress({ holdMs: 600, onHold: () => {} })
    expect(lp.isHolding.value).toBe(false)
    lp.onPointerDown(at(0, 0))
    expect(lp.isHolding.value).toBe(true)
    vi.advanceTimersByTime(600)
    expect(lp.isHolding.value).toBe(false)
    expect(lp.holdProgress.value).toBe(0)
  })

  it('nytt pointerdown rydder et forrige, uavsluttet trykk', () => {
    const onHold = vi.fn()
    const lp = useLongPress({ holdMs: 600, onHold })
    lp.onPointerDown(at(0, 0))
    vi.advanceTimersByTime(500)
    lp.onPointerDown(at(0, 0))   // ny press: forrige timer skal ikke fyre
    vi.advanceTimersByTime(200)
    expect(onHold).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(onHold).toHaveBeenCalledTimes(1)
  })
})
