#!/usr/bin/env python3
"""
MonnoM - Main entry point
Modular monnom for Linux
"""

import argparse
import sys
from src.dashboard import dashboard, print_once

def main():
    """Main entry point"""
    # Handle completion before argparse
    if "--completion" in sys.argv:
        idx = sys.argv.index("--completion")
        # Check if there's a next argument and if it starts with '-'
        if idx + 1 < len(sys.argv) and sys.argv[idx + 1].startswith("-"):
            print("flag:--once")
            print("flag:--once-pretty")
            print("flag:--interval")
            print("flag:--help")
        sys.exit(0)

    parser = argparse.ArgumentParser()
    parser.add_argument("-i", "--interval", type=int, default=2)
    parser.add_argument("--once", action="store_true", default=False, help="Print data once and exit")
    parser.add_argument("--once-pretty", action="store_true", default=False, help="Print data once as the pretty tables and exit")
    args = parser.parse_args()

    try:
        if args.once or args.once_pretty:
            print_once(pretty=args.once_pretty)
        else:
            dashboard(args.interval)
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
