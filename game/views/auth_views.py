from django.shortcuts import render, redirect
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import logout

def register_form(request):
    """
    HTML registration form.
    Uses Django’s built-in UserCreationForm.
    Signals will auto-create Player + cards.
    """
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            form.save()  # creates User → signals fire
            return redirect('login')
    else:
        form = UserCreationForm()

    return render(request, 'registration/register.html', {'form': form})

def logout_view(request):
    """
    Log the user out on GET and redirect to the login page.
    """
    logout(request)
    return redirect('login')