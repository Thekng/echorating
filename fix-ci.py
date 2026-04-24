import sys

def fix_workflow():
    with open(".github/workflows/ci.yml", "r") as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        if "node-version: 20" in line:
            new_lines.append(line.replace("20", "22"))
        else:
            new_lines.append(line)

    with open(".github/workflows/ci.yml", "w") as f:
        f.writelines(new_lines)

def fix_select_company_form():
    with open("components/auth/select-company-form.tsx", "r") as f:
        content = f.read()

    content = content.replace("You don't belong", "You don&apos;t belong")

    with open("components/auth/select-company-form.tsx", "w") as f:
        f.write(content)

def fix_time_input():
    with open("components/daily-log/time-input.tsx", "r") as f:
        content = f.read()

    content = content.replace("let input = e.target.value", "const input = e.target.value")

    with open("components/daily-log/time-input.tsx", "w") as f:
        f.write(content)

def fix_dashboard_queries():
    with open("features/dashboard/queries.ts", "r") as f:
        content = f.read()

    content = content.replace("let trend: DashboardTrendPoint[] = []", "const trend: DashboardTrendPoint[] = []")

    with open("features/dashboard/queries.ts", "w") as f:
        f.write(content)

if __name__ == "__main__":
    fix_workflow()
    fix_select_company_form()
    fix_time_input()
    fix_dashboard_queries()
