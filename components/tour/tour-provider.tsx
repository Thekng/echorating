'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'
import { Joyride, STATUS, type EventData } from 'react-joyride'
import { getTourStepsForRole } from './tour-steps'

type TourContextType = {
    startTour: () => void
    hasSeenTour: boolean
}

const TourContext = createContext<TourContextType | undefined>(undefined)

export function useTour() {
    const context = useContext(TourContext)
    if (!context) {
        throw new Error('useTour must be used within a TourProvider')
    }
    return context
}

type TourProviderProps = {
    children: ReactNode
    userRole?: string
}

export function TourProvider({ children, userRole = 'member' }: TourProviderProps) {
    const [run, setRun] = useState(false)
    const [hasSeenTour, setHasSeenTour] = useState(true)
    const [isMounted, setIsMounted] = useState(false)

    const steps = useMemo(() => getTourStepsForRole(userRole), [userRole])

    useEffect(() => {
        /* eslint-disable react-hooks/set-state-in-effect */
        setIsMounted(true)
        const seen = localStorage.getItem('echorating_tour_seen')
        if (!seen) {
            setHasSeenTour(false)
            const timer = setTimeout(() => {
                setRun(true)
            }, 1000)
            return () => clearTimeout(timer)
        }
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [])

    const startTour = () => {
        setRun(true)
    }

    const handleEvent = (data: EventData) => {
        if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
            setRun(false)
            setHasSeenTour(true)
            localStorage.setItem('echorating_tour_seen', 'true')
        }
    }

    return (
        <TourContext.Provider value={{ startTour, hasSeenTour }}>
            {children}
            {isMounted ? (
                <Joyride
                    steps={steps}
                    run={run}
                    continuous
                    onEvent={handleEvent}
                    styles={{
                        tooltip: {
                            backgroundColor: 'hsl(var(--card))',
                            color: 'hsl(var(--foreground))',
                        },
                        tooltipContainer: {
                            textAlign: 'left',
                        },
                        buttonPrimary: {
                            backgroundColor: 'hsl(var(--primary))',
                            color: 'hsl(var(--primary-foreground))',
                            borderRadius: 'var(--radius)',
                            padding: '8px 16px',
                            fontSize: '14px',
                            fontWeight: 500,
                        },
                        buttonBack: {
                            color: 'hsl(var(--muted-foreground))',
                            marginRight: '12px',
                        },
                        buttonSkip: {
                            color: 'hsl(var(--muted-foreground))',
                        },
                        overlay: {
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        },
                    }}
                />
            ) : null}
        </TourContext.Provider>
    )
}
